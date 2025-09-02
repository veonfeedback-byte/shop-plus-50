// scripts/scrape.mjs
import { chromium } from "playwright";
import fs from "fs";
import path from "path";

const BASE = "https://www.shop.markaz.app";

/* ------------ utils ------------ */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function ensureDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}
async function autoScroll(page, rounds = 10, pauseMs = 700) {
  let prev = 0;
  for (let i = 0; i < rounds; i++) {
    const h = await page.evaluate(() => document.body.scrollHeight || 0);
    if (h === prev) break;
    prev = h;
    await page.evaluate((y) => window.scrollTo(0, y), h);
    await page.waitForTimeout(pauseMs);
  }
}
async function mapLimit(items, limit, worker) {
  const out = new Array(items.length);
  let i = 0;
  const running = new Set();
  async function runOne(idx) {
    try {
      out[idx] = await worker(items[idx], idx);
    } catch {
      out[idx] = null;
    } finally {
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
  while (running.size) await sleep(50);
  return out;
}

/* ------------ product helpers ------------ */
async function extractProductLinks(page) {
  await page.waitForTimeout(1200);
  await autoScroll(page, 8, 600);

  return page.$$eval('a[href*="/explore/product"]', (as) => {
    const seen = new Set();
    const out = [];
    for (const a of as) {
      const href = a.getAttribute("href") || a.href || "";
      if (!href.includes("/explore/product/")) continue;
      const u = new URL(href, location.href).href;
      if (seen.has(u)) continue;
      seen.add(u);
      out.push(u);
    }
    return out;
  });
}

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
        if (
          it &&
          (it["@type"] === "Product" ||
            (Array.isArray(it["@type"]) && it["@type"].includes("Product")))
        ) {
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
  const text = await page.evaluate(() => document.body.innerText || "");
  const priceMatch = text.match(/(?:Rs|PKR|₨)\s*([\d,.]+)/i);
  const priceNum = priceMatch ? Number(priceMatch[1].replace(/[, ]/g, "")) : null;
  const img = await page
    .$$eval("img", (imgs) => {
      const all = imgs
        .filter((i) => i.src && i.width && i.height)
        .map((i) => ({ src: i.currentSrc || i.src, area: i.width * i.height }))
        .sort((a, b) => b.area - a.area);
      return all[0]?.src || null;
    })
    .catch(() => null);
  const codeMatch = text.match(
    /(?:SKU|Product\s*Code|Item\s*Code|Style\s*#)\s*[:#]?\s*([A-Za-z0-9\-_\/]+)/i
  );
  return {
    title,
    price: priceNum,
    currency: priceMatch ? "PKR" : null,
    images: img ? [img] : [],
    code: codeMatch ? codeMatch[1] : null,
    description: text,
  };
}

// ✅ Retry wrapper
async function parseProductPage(context, url, attempt = 1) {
  const page = await context.newPage();
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForTimeout(800);
    await autoScroll(page, 3, 500);
    const fromJsonLd = await parseJsonLdProduct(page);
    const base = fromJsonLd || (await parseFallback(page));
    const urlId = url.split("/").filter(Boolean).pop();
    return {
      ...base,
      id: base?.code || urlId || url,
      link: url,
      image: base?.images?.[0] || null,
    };
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

/* ------------ main scrape ------------ */
async function scrape() {
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

  console.log("🌐 Opening Explore…");
  await page.goto(`${BASE}/explore`, {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });
  await page.waitForTimeout(1200);

  const categories = await page.evaluate((base) => {
    function abs(href) {
      try {
        return new URL(href, base).href;
      } catch {
        return href;
      }
    }
    const anchors = Array.from(
      document.querySelectorAll('a[href*="/explore/home-page/"]')
    );
    const map = new Map();
    for (const a of anchors) {
      const full = abs(a.getAttribute("href") || a.href || "");
      if (!full.includes("/explore/home-page/")) continue;
      const idx =
        full.indexOf("/explore/home-page/") + "/explore/home-page/".length;
      const tail = full.slice(idx);
      const rootPart = decodeURIComponent(tail.split("/")[0]); // decode
      if (!rootPart) continue;
      const rootUrl = `${base}/explore/home-page/${encodeURIComponent(
        rootPart
      )}`; // encode
      if (!map.has(rootUrl)) {
        const name = (a.textContent || rootPart).trim();
        map.set(rootUrl, { name, url: rootUrl });
      }
    }
    return Array.from(map.values());
  }, BASE);

  console.log(`📂 Found ${categories.length} categories`);

  const out = { scrapedAt: new Date().toISOString(), categories: [] };

  for (const cat of categories) {
    console.log(`➡️ Category: ${cat.name}`);
    await page.goto(cat.url, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForTimeout(1000);

    const subcats = await page.evaluate((catUrl) => {
      function abs(href) {
        try {
          return new URL(href, location.href).href;
        } catch {
          return href;
        }
      }
      const anchors = Array.from(document.querySelectorAll("a[href]"));
      const out = [];
      for (const a of anchors) {
        const u = abs(a.getAttribute("href") || a.href || "");
        if (!u.startsWith(catUrl + "/")) continue;
        const rel = decodeURIComponent(u.slice(catUrl.length + 1)); // decode
        if (!rel) continue;
        const name = (a.textContent || rel).trim();
        out.push({ name, url: u });
      }
      const m = new Map();
      for (const s of out) if (!m.has(s.url)) m.set(s.url, s);
      return Array.from(m.values());
    }, cat.url);

    console.log(`   ↳ ${subcats.length} subcategories`);

    const catObj = { name: cat.name, url: cat.url, subcategories: [] };

    for (const sub of subcats) {
      console.log(`      • Subcategory: ${sub.name}`);
      await page.goto(sub.url, {
        waitUntil: "domcontentloaded",
        timeout: 60000,
      });
      await page.waitForTimeout(1000);

      const productLinks = await extractProductLinks(page);
      console.log(`         🔗 ${productLinks.length} product links`);

      const parsed = await mapLimit(productLinks, 4, (link) =>
        parseProductPage(context, link)
      );
      const products = parsed.filter(Boolean);

      console.log(`         🛒 ${products.length} products`);
      catObj.subcategories.push({ name: sub.name, url: sub.url, products });
    }

    out.categories.push(catObj);
  }

  const outPath = path.resolve("app/data/catalog.json");
  ensureDir(outPath);
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2));
  console.log(`✅ Saved ${out.categories.length} categories to ${outPath}`);

  await browser.close();
}

scrape().catch((e) => {
  console.error("❌ Scrape failed:", e);
  process.exit(1);
});
