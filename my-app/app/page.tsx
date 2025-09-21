// app/page.tsx
"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useLayoutEffect,
} from "react";
import Link from "next/link";
import Fuse from "fuse.js";
import Catalog, { Product } from "./lib/catalog";
import { HomeContext } from "./lib/HomeContext";
import { ArrowLeft } from "lucide-react";

/* ----------------- types ----------------- */
type IndexedProduct = Product & {
  categorySlug: string;
  subcategorySlug: string;
  mainImage?: string | null;
};

/* ----------------- utils ----------------- */
function shuffle<T>(arr: T[]): T[] {
  return [...arr].sort(() => Math.random() - 0.5);
}

// Cache categories globally to avoid repeated Catalog.getCategories() calls
const cachedCategories = Catalog.getCategories();

/* ---------- Small memoized product card with progressive blur ---------- */
function ProductCard({
  p,
  href,
  preconnect,
  onClick,
  eager,
}: {
  p: IndexedProduct;
  href: string;
  onClick?: () => void;
  preconnect?: boolean;
  eager?: boolean;
}) {
  const [loaded, setLoaded] = useState(false);

  // small inline style fallback skeleton; we avoid external libs
  const imgProps = {
    src: p.mainImage || "",
    alt: p.title,
    className:
      "w-full h-full object-cover transition-transform duration-300 ease-out " +
      (loaded ? "scale-100 filter-none" : "scale-105 blur-2xl grayscale"),
    loading: eager ? ("eager" as "eager") : ("lazy" as "lazy"),
    decoding: "async" as const,
    onLoad: () => setLoaded(true),
  };

  return (
    <Link href={href} onClick={onClick} className="block hover:scale-[1.02] transition">
      <div className="relative w-full aspect-square mb-2 overflow-hidden rounded-lg bg-gray-100">
        {p.mainImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img {...imgProps} />
        ) : (
          <div className="w-full h-full bg-gray-200 animate-pulse" />
        )}
      </div>

      <div className="text-sm line-clamp-2">{p.title}</div>
      <div className="font-semibold mt-1">Rs {p.price}</div>
    </Link>
  );
}

/* ---------- main component ---------- */
export default function HomePage() {
  const [query, setQuery] = useState("");
  const [showBackButton, setShowBackButton] = useState(false);

  const [homeProducts, setHomeProducts] = useState<IndexedProduct[]>([]);
  const [loadingHome, setLoadingHome] = useState(true);

  const [visibleHome, setVisibleHome] = useState<number>(4); // small for fastest first paint
  const [visibleSearch, setVisibleSearch] = useState<number>(10);

  const inputRef = useRef<HTMLInputElement | null>(null);

  const [priceSort, setPriceSort] = useState<"asc" | "desc" | null>(null);
  const [searchTriggered, setSearchTriggered] = useState(false);

  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [activeSubcategory, setActiveSubcategory] = useState<string | null>(null);

  /* ---------- Build product index once (memoized) ---------- */
  const allProducts = useMemo<IndexedProduct[]>(() => {
    const out: IndexedProduct[] = [];
    for (const cat of cachedCategories) {
      for (const sub of cat.subcategories) {
        for (const p of sub.products || []) {
          const mainImage =
            p.img ?? (Array.isArray((p as any).images) ? (p as any).images[0] : null);
          if (!mainImage) continue;
          const priceNum = Number(p.price) || 0;
          if (priceNum <= 0) continue;
          out.push({
            ...(p as IndexedProduct),
            categorySlug: cat.slug,
            subcategorySlug: sub.slug,
            mainImage,
          });
        }
      }
    }
    return out;
    // empty deps so it's built once per page load
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------- Initial home picks (instant render) ---------- */
  const initialHomePicks = useMemo(() => {
    const picks: IndexedProduct[] = [];
    for (const cat of cachedCategories) {
      for (const sub of cat.subcategories) {
        const valid = allProducts.filter(
          (p) => p.categorySlug === cat.slug && p.subcategorySlug === sub.slug
        );
        if (valid.length) {
          const random = valid[Math.floor(Math.random() * valid.length)];
          picks.push(random);
        }
      }
    }
    return picks;
  }, [allProducts]);

  useEffect(() => {
    // provide instant content (titles/prices + skeletons)
    setHomeProducts(initialHomePicks);
    setLoadingHome(false);

    // hydrate in background (defer heavy work using idle)
    const hydrate = () => {
      const cached = sessionStorage.getItem("homeProducts");
      if (cached) {
        try {
          setHomeProducts(JSON.parse(cached));
          return;
        } catch {
          // ignore parse error, continue
        }
      }
      const shuffled = shuffle(initialHomePicks);
      setHomeProducts(shuffled);
      try {
        sessionStorage.setItem("homeProducts", JSON.stringify(shuffled));
      } catch {
        /* ignore storage errors */
      }
    };

    if ("requestIdleCallback" in window) {
      (window as any).requestIdleCallback(hydrate, { timeout: 500 });
    } else {
      // fallback
      const t = setTimeout(hydrate, 200);
      return () => clearTimeout(t);
    }
  }, [initialHomePicks]);

  // expand visibleHome quickly after first paint so initial render is fast
  useEffect(() => {
    const id = setTimeout(() => setVisibleHome(6), 50);
    return () => clearTimeout(id);
  }, []);

  /* ---------- Fuse search index (deferred to idle to avoid blocking paint) ---------- */
  const [fuse, setFuse] = useState<Fuse<IndexedProduct> | null>(null);
  useEffect(() => {
    // defer building Fuse to idle so initial paint is snappy
    const build = () => {
      try {
        const f = new Fuse(allProducts, {
          keys: ["title"],
          threshold: 0.4,
          ignoreLocation: true,
          minMatchCharLength: 1,
        });
        setFuse(f);
      } catch {
        setFuse(null);
      }
    };

    if ("requestIdleCallback" in window) {
      (window as any).requestIdleCallback(build, { timeout: 800 });
    } else {
      const t = setTimeout(build, 300);
      return () => clearTimeout(t);
    }
  }, [allProducts]);

  /* ---------- Debounced query ---------- */
  const [debouncedQuery, setDebouncedQuery] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query.trim().toLowerCase()), 60);
    return () => clearTimeout(t);
  }, [query]);

  /* ---------- Category & Subcategory suggestions ---------- */
  const categorySuggestions = useMemo(() => {
    if (!debouncedQuery || searchTriggered) return [];
    const cats: {
      type: "category" | "subcategory";
      slug: string;
      title: string;
      parent?: string;
    }[] = [];
    const q = debouncedQuery;
    for (const cat of cachedCategories) {
      if (cat.name.toLowerCase().includes(q)) {
        cats.push({ type: "category", slug: cat.slug, title: cat.name });
      }
      for (const sub of cat.subcategories) {
        if (sub.name.toLowerCase().includes(q)) {
          cats.push({
            type: "subcategory",
            slug: sub.slug,
            title: sub.name,
            parent: cat.slug,
          });
        }
      }
    }
    return cats.slice(0, 6);
  }, [debouncedQuery, searchTriggered]);

  /* ---------- Search results (priority: exact -> phrase -> multiword -> fuzzy) ---------- */
  const searchResults = useMemo<IndexedProduct[]>(() => {
    if (!debouncedQuery || !searchTriggered || !fuse) return [];

    const q = debouncedQuery.trim().toLowerCase();
    const words = q.split(/\s+/).filter(Boolean);

    // 1. exact title equals
    const exact = allProducts.filter((p) => p.title.toLowerCase() === q);

    // 2. title contains full phrase
    const phrase = allProducts.filter(
      (p) => p.title.toLowerCase().includes(q) && !exact.includes(p)
    );

    // 3. all words present (multi-word)
    const multiWord = allProducts.filter(
      (p) =>
        words.length > 1 &&
        words.every((w) => p.title.toLowerCase().includes(w)) &&
        !exact.includes(p) &&
        !phrase.includes(p)
    );

    // 4. fuzzy fallback from Fuse
    const fuzzy = fuse
      .search(q, { limit: 300 })
      .map((r) => r.item)
      .filter((p) => !exact.includes(p) && !phrase.includes(p) && !multiWord.includes(p));

    const merged = [...exact, ...phrase, ...multiWord, ...fuzzy];
    const deduped = Array.from(new Map(merged.map((m) => [m.id, m])).values());

    if (priceSort) {
      deduped.sort((a, b) => {
        const pa = Number(a.price) || 0;
        const pb = Number(b.price) || 0;
        return priceSort === "asc" ? pa - pb : pb - pa;
      });
    }

    return deduped;
  }, [debouncedQuery, searchTriggered, fuse, allProducts, priceSort]);

  /* ---------- Final results: either searchResults OR category filter results ---------- */
  const finalResults = useMemo<IndexedProduct[]>(() => {
    if (activeCategory || activeSubcategory) {
      let filtered = allProducts.filter(
        (p) =>
          (!activeCategory || p.categorySlug === activeCategory) &&
          (!activeSubcategory || p.subcategorySlug === activeSubcategory)
      );
      if (priceSort) {
        filtered.sort((a, b) => {
          const pa = Number(a.price) || 0;
          const pb = Number(b.price) || 0;
          return priceSort === "asc" ? pa - pb : pb - pa;
        });
      }
      return filtered;
    }
    return searchResults;
  }, [activeCategory, activeSubcategory, allProducts, searchResults, priceSort]);

  /* ---------- Reset Home ---------- */
  const resetHome = useCallback(() => {
    setQuery("");
    setShowBackButton(false);
    setPriceSort(null);
    setVisibleSearch(10);
    setSearchTriggered(false);
    setActiveCategory(null);
    setActiveSubcategory(null);
    try {
      sessionStorage.clear();
    } catch {
      /* ignore */
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  /* ---------- product url ---------- */
  const productUrl = useCallback(
    (p: IndexedProduct) =>
      `/shop/${encodeURIComponent(p.categorySlug)}/${encodeURIComponent(p.subcategorySlug)}/${encodeURIComponent(p.id)}`,
    []
  );

  /* ---------- Restore state on back ---------- */
  useEffect(() => {
    const lastQ = sessionStorage.getItem("lastQuery");
    const lastScroll = sessionStorage.getItem("scrollY");
    const lastVisible = sessionStorage.getItem("visibleSearch");
    const lastCat = sessionStorage.getItem("lastCategory");
    const lastSub = sessionStorage.getItem("lastSubcategory");
    const lastSort = sessionStorage.getItem("lastSort");

    if (lastQ) {
      setQuery(lastQ);
      setShowBackButton(true);
      setSearchTriggered(true);
    }
    if (lastVisible) setVisibleSearch(Number(lastVisible));
    if (lastScroll) (window as any).__restoreScrollY = Number(lastScroll);
    if (lastCat) setActiveCategory(lastCat);
    if (lastSub) setActiveSubcategory(lastSub);
    if (lastSort) setPriceSort(lastSort as "asc" | "desc");
  }, []);

  useLayoutEffect(() => {
    if ((window as any).__restoreScrollY != null && finalResults.length > 0) {
      const y = (window as any).__restoreScrollY;
      delete (window as any).__restoreScrollY;
      setTimeout(() => {
        window.scrollTo({ top: y, behavior: "instant" as ScrollBehavior });
      }, 0);
    }
  }, [finalResults, visibleSearch]);

  /* ---------- Infinite scroll for Home (keeps same behavior) ---------- */
  useEffect(() => {
    function onScroll() {
      if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 200 && visibleHome < 20) {
        setVisibleHome((v) => Math.min(v + 6, 20));
      }
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [visibleHome]);

  /* ---------- Render ---------- */
  return (
    <HomeContext.Provider value={{ resetHome }}>
      <div className="space-y-6 p-4 pb-28">
        {/* Search Row */}
        <div className="flex items-center gap-3 w-full sticky top-0 z-30 bg-white/95 backdrop-blur-md py-2">
          {showBackButton && (
            <button onClick={resetHome} aria-label="Back" className="flex items-center justify-center p-2 text-gray-700 hover:text-black transition">
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}

          <div className="relative w-full">
            <input
              ref={inputRef}
              type="text"
              placeholder="Search products..."
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setSearchTriggered(false);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  inputRef.current?.blur();
                  setSearchTriggered(true);
                  setShowBackButton(true);
                  try {
                    sessionStorage.setItem("lastQuery", query);
                  } catch {}
                }
              }}
              className="w-full rounded-2xl bg-transparent border px-5 py-3 text-gray-800 shadow-lg focus:ring-2 focus:ring-indigo-500"
            />

            {/* suggestions dropdown */}
            {categorySuggestions.length > 0 && (
              <div className="absolute z-20 mt-2 w-full bg-white rounded-xl shadow-lg max-h-60 overflow-auto">
                {categorySuggestions.map((s) => (
                  <button
                    key={s.slug}
                    onClick={() => {
                      if (s.type === "category") {
                        setActiveCategory(s.slug);
                        setActiveSubcategory(null);
                        try {
                          sessionStorage.setItem("lastCategory", s.slug);
                          sessionStorage.removeItem("lastSubcategory");
                        } catch {}
                      } else {
                        setActiveCategory(s.parent || null);
                        setActiveSubcategory(s.slug);
                        try {
                          sessionStorage.setItem("lastCategory", s.parent || "");
                          sessionStorage.setItem("lastSubcategory", s.slug);
                        } catch {}
                      }
                      setSearchTriggered(true);
                      setShowBackButton(true);
                      setQuery(s.title);
                      try {
                        sessionStorage.setItem("lastQuery", s.title);
                      } catch {}
                    }}
                    className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-indigo-50 hover:text-indigo-600"
                  >
                    {s.title}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Search results */}
        {searchTriggered && (debouncedQuery || activeCategory || activeSubcategory) ? (
          <>
            {/* sort buttons */}
            <div className="flex items-center gap-3 mb-4">
              <button
                onClick={() => {
                  setPriceSort("asc");
                  try {
                    sessionStorage.setItem("lastSort", "asc");
                  } catch {}
                }}
                className={`px-4 py-2 rounded-lg border text-sm ${priceSort === "asc" ? "bg-indigo-600 text-white" : "bg-white text-gray-700"}`}
              >
                Price ↑
              </button>
              <button
                onClick={() => {
                  setPriceSort("desc");
                  try {
                    sessionStorage.setItem("lastSort", "desc");
                  } catch {}
                }}
                className={`px-4 py-2 rounded-lg border text-sm ${priceSort === "desc" ? "bg-indigo-600 text-white" : "bg-white text-gray-700"}`}
              >
                Price ↓
              </button>
              {priceSort && (
                <button
                  onClick={() => {
                    setPriceSort(null);
                    try {
                      sessionStorage.removeItem("lastSort");
                    } catch {}
                  }}
                  className="px-4 py-2 rounded-lg border text-sm bg-white text-gray-500"
                >
                  Reset
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              {finalResults.slice(0, visibleSearch).map((p, idx) => (
                <ProductCard
                  key={p.id}
                  p={p}
                  href={productUrl(p)}
                  onClick={() => {
                    try {
                      sessionStorage.setItem("scrollY", String(window.scrollY));
                      sessionStorage.setItem("lastQuery", query);
                      sessionStorage.setItem("visibleSearch", String(visibleSearch));
                      if (activeCategory) sessionStorage.setItem("lastCategory", activeCategory);
                      if (activeSubcategory) sessionStorage.setItem("lastSubcategory", activeSubcategory);
                      if (priceSort) sessionStorage.setItem("lastSort", priceSort);
                    } catch {}
                  }}
                  eager={idx < 4}
                />
              ))}
            </div>

            {visibleSearch < finalResults.length && (
              <div className="flex justify-center mt-6">
                <button
                  onClick={() => {
                    const next = visibleSearch + 20;
                    setVisibleSearch(next);
                    try {
                      sessionStorage.setItem("visibleSearch", String(next));
                    } catch {}
                  }}
                  className="px-6 py-3 rounded-xl bg-indigo-600 text-white shadow hover:bg-indigo-700 transition"
                >
                  Load more
                </button>
              </div>
            )}
          </>
        ) : loadingHome ? (
          <div className="flex justify-center items-center py-10">
            <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <section>
            <h1 className="text-2xl font-semibold">🔥 Trending</h1>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mt-4">
              {homeProducts.slice(0, visibleHome).map((p, idx) => (
                <ProductCard
                  key={p.id}
                  p={p}
                  href={productUrl(p)}
                  onClick={() => {
                    try {
                      sessionStorage.setItem("scrollY", String(window.scrollY));
                    } catch {}
                  }}
                  eager={idx < 4}
                />
              ))}
            </div>

            {visibleHome >= 20 && visibleHome < homeProducts.length && (
              <div className="flex justify-center mt-6">
                <button
                  onClick={() => setVisibleHome((v) => v + 20)}
                  className="px-6 py-3 rounded-xl bg-indigo-600 text-white shadow hover:bg-indigo-700 transition"
                >
                  Load more
                </button>
              </div>
            )}
          </section>
        )}
      </div>
    </HomeContext.Provider>
  );
}
