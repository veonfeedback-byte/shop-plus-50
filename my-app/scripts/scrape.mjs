// scripts/scrape.mjs
import { chromium } from "playwright";
import fs from "fs";
import path from "path";

const BASE = "https://www.shop.markaz.app";
const OUT_PATH = path.resolve("app/data/catalog.json");
const TMP_PATH = OUT_PATH + ".tmp";

/* ---------------- config via env ---------------- */
const PARSE_CONCURRENCY = Number(process.env.PARSE_CONCURRENCY || "6");
const MAX_PRODUCTS_PER_SUBCAT = Number(process.env.MAX_PRODUCTS_PER_SUBCAT || "0"); // 0 = unlimited
const REFRESH_DAYS = Number(process.env.REFRESH_DAYS || "7"); // re-parse cache older than this many days

/* ---------------- utils ---------------- */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function ensureDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}
function nowIso() {
  return new Date().toISOString();
}
function daysBetween(aIso, bIso) {
  try {
    const a = new Date(aIso).getTime();
    const b = new Date(bIso).getTime();
    return Math.abs((b - a) / (1000 * 60 * 60 * 24));
  } catch {
    return Infinity;
  }
}

/** Load checkpoint if exists */
function loadCheckpoint() {
  if (fs.existsSync(TMP_PATH)) {
    try {
      return JSON.parse(fs.readFileSync(TMP_PATH, "utf8"));
    } catch {
      return null;
    }
  }
  return null;
}

/** Load previous final (used as cache for staleness) */
function loadPrevious() {
  if (fs.existsSync(OUT_PATH)) {
    try {
      return JSON.parse(fs.readFileSync(OUT_PATH, "utf8"));
    } catch {
      return null;
    }
  }
  return null;
}

/** Save checkpoint (atomic-ish) */
function saveCheckpoint(out) {
  ensureDir(TMP_PATH);
  fs.writeFileSync(TMP_PATH, JSON.stringify(out, null, 2));
}

/** Concurrency-limited async map with progress logs */
async function mapLimitWithProgress(items, limit, worker, label = "Work") {
  const out = new Array(items.length);
  let i = 0;
  let completed = 0;
  const running = new Set();

  async function runOne(idx) {
    try {
      out[idx] = await worker(items[idx], idx);
    } catch {
      out[idx] = null;
    } finally {
      completed++;
      if (completed % 50 === 0 || completed === items.length) {
        console.log(`🕵️ ${label} ${completed}/${items.length}`);
      }
      running.delete(idx);
      if (i < items.length) {
        const next = i++;
        running.add(next);
        void runOne(next);
      }
    }
  }

  while (i < Math.min(limit, items.length)) {
    const idx = i++;
    running.add(idx);
    void runOne(idx);
  }
  while (running.size) await sleep(30);
  return out;
}

/* ---------------- scraping helpers ---------------- */
async function primePage(page, rounds = 2, pauseMs = 600) {
  for (let i = 0; i < rounds; i++) {
    await page.evaluate(() => window.scrollBy(0, window.innerHeight));
    await page.waitForTimeout(pauseMs);
  }
}

async function collectProductLinks(page) {
  return await page.$$eval('a[href*="/explore/product"]', (as) => {
    const seen = new Set();
    const out = [];
    for (const a of as) {
      const raw = a.getAttribute("href") || a.href || "";
      if (!raw) continue;
      let abs = raw;
      try {
        abs = new URL(raw, location.href).href;
      } catch {}
      try {
        const u = new URL(abs, location.href);
        const key = u.pathname; // stable per product
        if (!seen.has(key)) {
          seen.add(key);
          out.push(u.href);
        }
      } catch {}
    }
    return out;
  });
}

async function infiniteScrollCollect(
  page,
  { maxRounds = 2000, stepPause = 700, stableThreshold = 6 }
) {
  const seen = new Set();
  let lastTotal = 0;
  let stable = 0;

  for (let round = 1; round <= maxRounds; round++) {
    await page.evaluate(() =>
      window.scrollBy(0, Math.max(200, window.innerHeight * 0.9))
    );
    try {
      await page.mouse.wheel(0, 600);
    } catch {}
    await page.waitForTimeout(stepPause);

    const linksNow = await collectProductLinks(page);
    for (const l of linksNow) seen.add(l);

    const total = seen.size;
    const delta = total - lastTotal;
    console.log(`         📄 Scroll ${round}: +${delta} new, total ${total}`);

    if (delta === 0) {
      stable++;
    } else {
      stable = 0;
      lastTotal = total;
    }
    if (stable >= stableThreshold) break;
  }
  return Array.from(seen);
}

async function paginationCollect(page, { startFrom = 2, stepPause = 900 }) {
  const seen = new Set(await collectProductLinks(page));
  let lastTotal = seen.size;
  let pageNum = startFrom;

  while (true) {
    const clicked = await page.evaluate((pageNum) => {
      function visible(el) {
        const cs = getComputedStyle(el);
        const r = el.getBoundingClientRect();
        return (
          cs.display !== "none" &&
          cs.visibility !== "hidden" &&
          r.width > 0 &&
          r.height > 0
        );
      }
      const nodes = Array.from(
        document.querySelectorAll("button,a,[role='button']")
      );
      let node = nodes.find(
        (n) => visible(n) && (n.textContent || "").trim() === String(pageNum)
      );
      if (!node)
        node = nodes.find(
          (n) => visible(n) && (n.textContent || "").trim().toLowerCase() === "next"
        );
      if (node) {
        node.click();
        return true;
      }
      return false;
    }, pageNum);

    if (!clicked) break;
    await page.waitForTimeout(stepPause);
    await primePage(page, 1, 300);

    const linksNow = await collectProductLinks(page);
    for (const l of linksNow) seen.add(l);

    const total = seen.size;
    const delta = total - lastTotal;
    console.log(`         📄 Page ${pageNum}: +${delta} new, total ${total}`);
    if (delta <= 0) break;

    lastTotal = total;
    pageNum++;
  }
  return Array.from(seen);
}

async function extractAllProductLinks(page, subUrl) {
  await page.goto(subUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(5000);
  await primePage(page, 3, 1000);

  await page
    .waitForSelector('a[href*="/explore/product"]', { timeout: 15000 })
    .catch(() => {});
  const fromScroll = await infiniteScrollCollect(page, {});
  let aggregate = new Set(fromScroll);

  if (aggregate.size <= 40) {
    console.log("         🔁 Falling back to explicit pagination…");
    const fromPaging = await paginationCollect(page, {});
    for (const u of fromPaging) aggregate.add(u);
  }

  let result = Array.from(aggregate);
  if (MAX_PRODUCTS_PER_SUBCAT > 0 && result.length > MAX_PRODUCTS_PER_SUBCAT) {
    result = result.slice(0, MAX_PRODUCTS_PER_SUBCAT);
  }
  return result;
}

/* ---------------- product parsing ---------------- */
async function parseJsonLdProduct(page) {
  const blocks = await page.$$eval(
    'script[type="application/ld+json"]',
    (nodes) => nodes.map((n) => n.textContent || "")
  );
  for (const raw of blocks) {
    try {
      const data = JSON.parse(raw);
      const items = Array.isArray(data)
        ? data
        : data["@graph"]
        ? data["@graph"]
        : [data];
      for (const it of items) {
        const types = Array.isArray(it["@type"]) ? it["@type"] : [it["@type"]];
        if (types.includes("Product")) {
          const images = Array.isArray(it.image)
            ? it.image
            : it.image
            ? [it.image]
            : [];
          const offer =
            (Array.isArray(it.offers) ? it.offers[0] : it.offers) || {};
          return {
            title: it.name || "",
            code: it.sku || null,
            brand:
              typeof it.brand === "string" ? it.brand : it.brand?.name || null,
            price: offer.price
              ? Number(String(offer.price).replace(/[, ]/g, ""))
              : null,
            currency: offer.priceCurrency || "PKR",
            availability: offer.availability || null,
            images,
            description:
              typeof it.description === "string" ? it.description : "",
          };
        }
      }
    } catch {}
  }
  return null;
}

async function parseFallback(page) {
  const title =
    (await page.$eval("h1", (el) => el.textContent?.trim()).catch(() => "")) ||
    (await page.title());
  const metaDesc =
    (await page
      .$eval('meta[name="description"]', (m) => m.getAttribute("content"))
      .catch(() => "")) || "";
  const text = await page.evaluate(() => document.body.innerText || "");
  const description = metaDesc || text;

  const priceMatch = (text || "").match(/(?:Rs|PKR|₨)\s*([\d,.]+)/i);
  const priceNum = priceMatch
    ? Number(priceMatch[1].replace(/[, ]/g, ""))
    : null;

  const img = await page
    .$$eval("img", (imgs) => {
      const all = imgs
        .filter((i) => i.src && i.width && i.height)
        .map((i) => ({
          src: i.currentSrc || i.src,
          area: (i.width || 0) * (i.height || 0),
        }))
        .sort((a, b) => b.area - a.area);
      return all[0]?.src || null;
    })
    .catch(() => null);

  return {
    title,
    price: priceNum,
    currency: priceMatch ? "PKR" : null,
    images: img ? [img] : [],
    description,
  };
}

async function parseProductPage(context, url, attempt = 1) {
  const page = await context.newPage();
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForTimeout(700);
    await primePage(page, 1, 350);

    const fromJsonLd = await parseJsonLdProduct(page);
    const fallback = fromJsonLd ? null : await parseFallback(page);
    const base = fromJsonLd || fallback || {};
    const urlId = url.split("/").filter(Boolean).pop();

    const final = {
      ...base,
      id: base?.code || urlId || url,
      link: url,
      image: base?.images?.[0] || null,
      updatedAt: nowIso(),
    };
    return final;
  } catch (e) {
    if (attempt < 2) {
      console.warn(`🔄 retrying product: ${url}`);
      return await parseProductPage(context, url, attempt + 1);
    }
    console.warn("⚠️ product parse failed:", url, e?.message || e);
    return null;
  } finally {
    await page.close().catch(() => {});
  }
}

/* ---------------- main scrape (FULL SYNC) ---------------- */
const HP_PREFIX = "/explore/home-page/";

async function scrape() {
  // Load previous final as cache (for staleness)
  const previous = loadPrevious();
  const cacheByLink = new Map();
  if (previous?.categories?.length) {
    for (const c of previous.categories) {
      for (const s of c.subcategories || []) {
        for (const p of s.products || []) {
          if (p?.link) cacheByLink.set(p.link, p);
        }
      }
    }
  }

  // Fresh OUT (full-sync replaces data)
  const checkpoint = loadCheckpoint(); // if resuming mid-run
  const out =
    checkpoint ||
    { scrapedAt: nowIso(), categories: [] };

  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  const context = await browser.newContext({
    viewport: { width: 1366, height: 900 },
    userAgent:
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
  });
  const page = await context.newPage();
  page.setDefaultTimeout(60000);

  console.log("🌐 Opening Explore…");
  await page.goto(`${BASE}/explore`, {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });
  await page.waitForTimeout(5000);
  await primePage(page, 3, 1000);

  const categories = await page.evaluate(
    ({ base, HP_PREFIX }) => {
      const anchors = Array.from(
        document.querySelectorAll(`a[href*="${HP_PREFIX}"]`)
      );
      const map = new Map();
      for (const a of anchors) {
        let full = a.getAttribute("href") || a.href || "";
        try {
          full = new URL(full, base).href;
        } catch {}
        const parts = (full.split(HP_PREFIX)[1] || "")
          .split("/")
          .filter(Boolean);
        if (!parts.length) continue;
        const catName = decodeURIComponent(parts[0]);
        const rootUrl = `${base}${HP_PREFIX}${encodeURIComponent(catName)}`;
        if (!map.has(rootUrl)) map.set(rootUrl, { name: catName, url: rootUrl });
      }
      return Array.from(map.values());
    },
    { base: BASE, HP_PREFIX }
  );

  console.log(`📂 Found ${categories.length} categories`);

  // Build categories fresh (full sync)
  // If no checkpoint, start fresh, otherwise continue
  if (!checkpoint) {
    out.categories = [];
  }

  for (const cat of categories) {
    console.log(`➡️ Category: ${cat.name}`);
    await page.goto(cat.url, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForTimeout(5000);
    await primePage(page, 3, 1000);

    const subcats = await page.evaluate(
      ({ catUrl, base, HP_PREFIX }) => {
        const u = new URL(catUrl, base);
        const catName = decodeURIComponent(u.pathname.split("/").pop());
        const anchors = Array.from(document.querySelectorAll("a[href]"));
        const found = [];
        for (const a of anchors) {
          let full = a.getAttribute("href") || a.href || "";
          try {
            full = new URL(full, base).href;
          } catch {}
          if (!full.includes(HP_PREFIX)) continue;
          const parts = (full.split(HP_PREFIX)[1] || "")
            .split("/")
            .filter(Boolean)
            .map(decodeURIComponent);
          if (parts.length < 2) continue;
          if ((parts[0] || "").toLowerCase() !== catName.toLowerCase()) continue;
          found.push({ name: parts[1], url: full });
        }
        const m = new Map();
        for (const s of found) if (!m.has(s.url)) m.set(s.url, s);
        return Array.from(m.values());
      },
      { catUrl: cat.url, base: BASE, HP_PREFIX }
    );

    console.log(`   ↳ ${subcats.length} subcategories`);

    const catObj = { name: cat.name, url: cat.url, subcategories: [] };

    for (const sub of subcats) {
      console.log(`      • Subcategory: ${sub.name}`);

      const productLinks = await extractAllProductLinks(page, sub.url);
      console.log(`         🔗 ${productLinks.length} product links`);

      // FULL SYNC behavior:
      // - Build this subcategory's products exactly from live links
      // - Use cache only if fresh (updatedAt within REFRESH_DAYS) AND has a description
      const products = [];
      const today = nowIso();

      await mapLimitWithProgress(
        productLinks,
        PARSE_CONCURRENCY,
        async (link) => {
          const cached = cacheByLink.get(link);
          const freshEnough =
            cached?.updatedAt &&
            daysBetween(cached.updatedAt, today) <= REFRESH_DAYS &&
            (cached.description?.trim()?.length || 0) > 0;

          if (freshEnough) {
            products.push(cached);
            return;
          }

          const parsed = await parseProductPage(context, link);
          if (parsed) {
            products.push(parsed);
          }
        },
        "Parsing product"
      );

      console.log(`         🛒 ${products.length} products`);

      // Order by link order (stable)
      const byLink = new Map(products.map((p) => [p.link, p]));
      const ordered = productLinks
        .map((L) => byLink.get(L))
        .filter(Boolean);

      catObj.subcategories.push({
        name: sub.name,
        url: sub.url,
        products: ordered,
      });

      // Save checkpoint after each subcategory
      const tmpOut = JSON.parse(JSON.stringify(out));
      // When checkpointing, include progress so far (categories built so far + current cat)
      const existingIndex = tmpOut.categories.findIndex((c) => c.name === catObj.name);
      if (existingIndex === -1) {
        tmpOut.categories.push(catObj);
      } else {
        tmpOut.categories[existingIndex] = catObj;
      }
      tmpOut.scrapedAt = nowIso();
      saveCheckpoint(tmpOut);
      console.log(`💾 Checkpoint saved after ${cat.name} -> ${sub.name}`);
    }

    // push finished category into OUT
    out.categories.push(catObj);
    saveCheckpoint(out);
  }

  // Finalize
  ensureDir(OUT_PATH);
  if (fs.existsSync(TMP_PATH)) {
    fs.renameSync(TMP_PATH, OUT_PATH); // move checkpoint to final
  } else {
    fs.writeFileSync(OUT_PATH, JSON.stringify(out, null, 2));
  }
  console.log(`✅ Final saved to ${OUT_PATH}`);

  await browser.close();
}

scrape().catch((e) => {
  console.error("❌ Scrape failed:", e);
  process.exit(1);
});
