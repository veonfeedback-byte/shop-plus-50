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
import Head from "next/head";
import Fuse from "fuse.js";
import Catalog, { Product } from "./lib/catalog";
import { HomeContext } from "./lib/HomeContext";
import { ArrowLeft, Search, Camera } from "lucide-react";

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

// Cache categories globally
const cachedCategories = Catalog.getCategories();

/* ---------- Small memoized product card with tags + modern price ---------- */
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

  const inflated = Math.round(Number(p.price) * 1.2); // +20%
  const tags = ["Latest", "Sale", "Hot"]; // you can customize logic later

  // inside ProductCard
const tag = useMemo(() => {
  // pick based on product id → always the same
  const index = (p.id.charCodeAt(0) + p.id.length) % tags.length;
  return tags[index];
}, [p.id]);


  return (
    <Link
      href={href}
      onClick={onClick}
      className="block group rounded-xl overflow-hidden shadow hover:shadow-xl transition "
    >
      {/* image with badge */}
      <div className="relative w-full aspect-square overflow-hidden">
        {p.mainImage ? (
          <img
            src={p.mainImage}
            alt={p.title}
            className={`w-full h-full object-cover transition duration-500 group-hover:scale-105 ${
              loaded ? "blur-0 grayscale-0" : "blur-xl grayscale"
            }`}
            loading={eager ? "eager" : "lazy"}
            onLoad={() => setLoaded(true)}
          />
        ) : (
          <div className="w-full h-full bg-gray-200 animate-pulse" />
        )}

        {/* product tag */}
        <span className="absolute top-2 left-2 bg-black text-white text-xs font-medium px-2 py-1 rounded-md border border-white-300 shadow-sm">
          {tag}
        </span>
      </div>

      {/* content */}
      <div className="p-3">
        <div className="text-sm font-medium line-clamp-2 group-hover:text-indigo-600 transition">
          {p.title}
        </div>
        <div className="mt-1">
          <span className="text-gray-400 line-through text-sm mr-2">
            Rs {inflated}
          </span>
          <span className="text-lg font-semibold text-gray-900">
            Rs {p.price}
          </span>
        </div>
      </div>
    </Link>
  );
}


/* ---------- main component ---------- */
export default function HomePage() {
  const [query, setQuery] = useState("");
  const [showBackButton, setShowBackButton] = useState(false);


  /* ---------- Build product index once ---------- */
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
  }, []);

   /* ---------- Initial home picks ---------- */
  const initialHomePicks = useMemo(() => {
    const picks: IndexedProduct[] = [];
    for (const cat of cachedCategories) {
      for (const sub of cat.subcategories) {
        const valid = allProducts.filter(
          (p) => p.categorySlug === cat.slug && p.subcategorySlug === sub.slug
        );
        if (valid.length) {
          picks.push(valid[0]); // always pick first → stable across SSR/CSR
        }
      }
    }
    return picks;
  }, [allProducts]);


  const [homeProducts, setHomeProducts] = useState<IndexedProduct[]>(initialHomePicks);

  const [visibleHome, setVisibleHome] = useState<number>(20);
  const [visibleSearch, setVisibleSearch] = useState<number>(10);

  const inputRef = useRef<HTMLInputElement | null>(null);

  const [priceSort, setPriceSort] = useState<"asc" | "desc" | null>(null);
  const [searchTriggered, setSearchTriggered] = useState(false);

  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [activeSubcategory, setActiveSubcategory] = useState<string | null>(null);
  const [searchFocused, setSearchFocused] = useState(false);


  useEffect(() => {
    const hydrate = () => {
      const cached = sessionStorage.getItem("homeProducts");
      if (cached) {
        try {
          setHomeProducts(JSON.parse(cached));
          return;
        } catch {}
      }
      const shuffled = shuffle(initialHomePicks);
      setHomeProducts(shuffled);
      try {
        sessionStorage.setItem("homeProducts", JSON.stringify(shuffled));
      } catch {}
    };

    if ("requestIdleCallback" in window) {
      (window as any).requestIdleCallback(hydrate, { timeout: 200 });
    } else {
      const t = setTimeout(hydrate, 100);
      return () => clearTimeout(t);
    }
  }, [initialHomePicks]);

  /* ---------- Fuse search ---------- */
  const [fuse, setFuse] = useState<Fuse<IndexedProduct> | null>(null);
  useEffect(() => {
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

  /* ---------- Search results ---------- */
  const searchResults = useMemo<IndexedProduct[]>(() => {
    if (!debouncedQuery || !searchTriggered || !fuse) return [];

    const q = debouncedQuery.trim().toLowerCase();
    const words = q.split(/\s+/).filter(Boolean);

    const exact = allProducts.filter((p) => p.title.toLowerCase() === q);
    const phrase = allProducts.filter(
      (p) => p.title.toLowerCase().includes(q) && !exact.includes(p)
    );
    const multiWord = allProducts.filter(
      (p) =>
        words.length > 1 &&
        words.every((w) => p.title.toLowerCase().includes(w)) &&
        !exact.includes(p) &&
        !phrase.includes(p)
    );
    const fuzzy = fuse
      .search(q, { limit: 300 })
      .map((r) => r.item)
      .filter((p) => !exact.includes(p) && !phrase.includes(p) && !multiWord.includes(p));

    const merged = [...exact, ...phrase, ...multiWord, ...fuzzy];
    const deduped = Array.from(
      new Map(merged.map((m) => [`${m.categorySlug}-${m.subcategorySlug}-${m.id}`, m])).values()
    );

    if (priceSort) {
      deduped.sort((a, b) => {
        const pa = Number(a.price) || 0;
        const pb = Number(b.price) || 0;
        return priceSort === "asc" ? pa - pb : pb - pa;
      });
    }

    return deduped;
  }, [debouncedQuery, searchTriggered, fuse, allProducts, priceSort]);

  /* ---------- Final results ---------- */
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
    } catch {}
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  /* ---------- product url ---------- */
  const productUrl = useCallback(
    (p: IndexedProduct) =>
      `/shop/${encodeURIComponent(p.categorySlug)}/${encodeURIComponent(
        p.subcategorySlug
      )}/${encodeURIComponent(p.id)}`,
    []
  );

  /* ---------- Restore state ---------- */
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

  useEffect(() => {
    function onScroll() {
      if (
        window.innerHeight + window.scrollY >= document.body.offsetHeight - 200 &&
        visibleHome < 20
      ) {
        setVisibleHome((v) => Math.min(v + 6, 20));
      }
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [visibleHome]);

  /* ---------- Render ---------- */
  return (
    <HomeContext.Provider value={{ resetHome }}>
      <Head>
        <title>Trolly – Online Shopping in Pakistan | Best Prices 2025</title>
        <meta
          name="description"
          content="Trolly is your trusted online shopping store in Pakistan. Explore trending fashion, electronics, home products & more at affordable prices."
        />
        <meta
          name="keywords"
          content="Trolly, online shopping Pakistan, buy products online, best prices Pakistan, fashion, electronics"
        />
        <meta name="robots" content="index, follow" />
        <link rel="canonical" href="https://trollypk.vercel.app/" />

        {/* Open Graph */}
        <meta property="og:type" content="website" />
        <meta property="og:title" content="Trolly – Online Shopping in Pakistan" />
        <meta
          property="og:description"
          content="Buy latest fashion, electronics & more at Trolly.pk with best prices and fast delivery."
        />
        <meta property="og:url" content="https://trollypk.vercel.app/" />
        <meta property="og:image" content="/assets/Logo.png" />

        {/* Schema.org */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Organization",
              name: "Trolly",
              url: "https://trollypk.vercel.app",
              logo: "https://trollypk.vercel.app/assets/Logo.png",
              sameAs: ["https://facebook.com", "https://instagram.com", "https://twitter.com"],
            }),
          }}
        />
      </Head>

      <div className="space-y-6 p-4 pb-28">
        {/* Search Row (modern style) */}
        <div className="sticky top-0 z-30 bg-white/60 backdrop-blur-md py-3 px-1 border-b border-transparent">
          <div className="max-w-4xl mx-auto flex items-center gap-3">
            {showBackButton && (
              <button
                onClick={resetHome}
                aria-label="Back"
                className="flex items-center justify-center p-2 text-gray-700 hover:text-black transition"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}

            <div className="relative flex-1">
              <div
                className={
                  "flex items-center w-full rounded-[14px] px-4 py-2 transition-shadow transition-colors " +
                  (searchFocused
                    ? "shadow-lg border-2 border-green-400 bg-white"
                    : "shadow-sm border border-gray-200 bg-white/95")
                }
              >
                <Search className={`w-5 h-5 mr-3 ${searchFocused ? "text-green-500" : "text-gray-400"}`} />

                <input
                  ref={inputRef}
                  type="search"
                  inputMode="search"
                  enterKeyHint="search"
                  placeholder="Search Products here"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setSearchTriggered(false);
                  }}
                  onFocus={() => setSearchFocused(true)}
                  onBlur={() => setSearchFocused(false)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      inputRef.current?.blur();

                      // immediately apply query to debouncedQuery so Enter is instant
                      const normalized = query.trim().toLowerCase();
                      setDebouncedQuery(normalized);

                      // reset some search state and trigger
                      setActiveCategory(null);
                      setActiveSubcategory(null);
                      setPriceSort(null);
                      setVisibleSearch(10);

                      setSearchTriggered(true);
                      setShowBackButton(true);

                      try {
                        sessionStorage.setItem("lastQuery", query);
                        sessionStorage.removeItem("lastCategory");
                        sessionStorage.removeItem("lastSubcategory");
                        sessionStorage.removeItem("lastSort");
                        sessionStorage.setItem("visibleSearch", "10");
                      } catch {}
                    }
                  }}
                  className="flex-1 bg-transparent outline-none text-gray-800 placeholder-gray-500"
                />

              </div>

              {/* suggestions dropdown (keeps your existing logic but styled) */}
              {categorySuggestions.length > 0 && (
                <div className="absolute z-40 mt-2 w-full bg-white rounded-xl shadow-lg max-h-60 overflow-auto border border-gray-100">
                  {categorySuggestions.map((s) => (
                    <button
                      key={`${s.type}-${s.parent || "root"}-${s.slug}`}
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
                      className="block w-full text-left px-4 py-3 text-sm text-gray-700 hover:bg-indigo-50 hover:text-indigo-600"
                    >
                      {s.title}
                    </button>
                  ))}
                </div>
              )}
            </div>
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
                className={`px-4 py-2 rounded-lg border text-sm ${
                  priceSort === "asc" ? "bg-indigo-600 text-white" : "bg-white text-gray-700"
                }`}
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
                className={`px-4 py-2 rounded-lg border text-sm ${
                  priceSort === "desc" ? "bg-indigo-600 text-white" : "bg-white text-gray-700"
                }`}
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

            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {finalResults.slice(0, visibleSearch).map((p, idx) => (
                <ProductCard
                  key={`${p.categorySlug}-${p.subcategorySlug}-${p.id}`}
                  p={p}
                  href={productUrl(p)}
                  onClick={() => {
                    try {
                      sessionStorage.setItem("scrollY", String(window.scrollY));
                      sessionStorage.setItem("lastQuery", query);
                      sessionStorage.setItem("visibleSearch", String(visibleSearch));
                      if (activeCategory) sessionStorage.setItem("lastCategory", activeCategory);
                      if (activeSubcategory)
                        sessionStorage.setItem("lastSubcategory", activeSubcategory);
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
            ) : (
            <section>
            <h1 className="text-2xl font-semibold">🔥 Trending</h1>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-4">
              {homeProducts.slice(0, visibleHome).map((p, idx) => (
                <ProductCard
                  key={`${p.categorySlug}-${p.subcategorySlug}-${p.id}`}
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
