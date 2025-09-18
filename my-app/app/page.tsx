// app/page.tsx
"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import Fuse from "fuse.js";
import { ArrowLeft } from "lucide-react";
import Catalog, { Product, Category, Subcategory } from "./lib/catalog";
import { HomeContext } from "./lib/HomeContext";
import { categoryIcons } from "./lib/categoryIcons";

/* ----------------- types ----------------- */
type Suggestion = {
  type: "category" | "subcategory" | "product";
  name: string;
  slug: string;
  parent?: string;
  id?: string;
  reactKey?: string;
};

type IndexedProduct = Product & {
  categorySlug: string;
  categoryName: string;
  subcategorySlug: string;
  subcategoryName: string;
  mainImage?: string | null;
};

type LastSearchState = {
  query?: string;
  scrollY?: number;
  activeFilter?: Suggestion | null;
  activeCategorySlug?: string | null;
  activeSubcategorySlug?: string | null;
};

function scrollToPosition(defaultTop?: number) {
  const raw = sessionStorage.getItem("lastSearch");
  let top = defaultTop ?? 0;

  if (raw) {
    try {
      const parsed = JSON.parse(raw) as LastSearchState;
      if (parsed.scrollY !== undefined) top = parsed.scrollY;
    } catch {}
  }

  // Actually scroll to the saved position
  window.scrollTo({ top, behavior: "auto" });
}



function isBackNavigation() {
  if (typeof window === "undefined") return false;
  const entries = window.performance.getEntriesByType("navigation") as PerformanceNavigationTiming[];
  return entries.length && entries[0].type === "back_forward";
}

/* ----------------- component ----------------- */
export default function HomePage() {
  const [query, setQuery] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(true);
  const [showBackButton, setShowBackButton] = useState(false);

  const [homeProducts, setHomeProducts] = useState<IndexedProduct[]>([]);
  const [visibleProducts, setVisibleProducts] = useState<IndexedProduct[]>([]);
  const [loadingHome, setLoadingHome] = useState(true);
  const [loadingProducts, setLoadingProducts] = useState(false);

  const [activeCategory, setActiveCategory] = useState<Category | null>(null);
  const [activeSubcategory, setActiveSubcategory] = useState<Subcategory | null>(null);
  const [activeFilter, setActiveFilter] = useState<Suggestion | null>(null);
  const [sortBy, setSortBy] = useState<"asc" | "desc" | null>(null);

  const suggestionsRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const catRowRef = useRef<HTMLDivElement | null>(null);

  const isDown = useRef(false);
  const startX = useRef(0);
  const scrollLeft = useRef(0);

  /* ---------- Build product index ---------- */
  const allProducts = useMemo<IndexedProduct[]>(() => {
    const out: IndexedProduct[] = [];
    Catalog.getCategories().forEach((cat) => {
      cat.subcategories.forEach((sub) => {
        (sub.products || []).forEach((p: Product) => {
          const mainImage =
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            p.img ?? (Array.isArray((p as any).images) ? (p as any).images[0] : null);
          if (!mainImage) return;
          const priceNum = p.price == null ? 0 : Number(p.price);
          if (!priceNum || Number.isNaN(priceNum) || priceNum <= 0) return;

          out.push({
            ...(p as IndexedProduct),
            categorySlug: cat.slug,
            categoryName: cat.name,
            subcategorySlug: sub.slug,
            subcategoryName: sub.name,
            mainImage,
          });
        });
      });
    });
    return out;
  }, []);

  /* ---------- Fuse instance (search) ---------- */
  const fuse = useMemo(() => {
    return new Fuse(allProducts, {
      keys: ["title"],
      threshold: 0.35,
      ignoreLocation: true,
      minMatchCharLength: 2,
    });
  }, [allProducts]);

  /* ---------- Debounced query (fast) ---------- */
  const [debouncedQuery, setDebouncedQuery] = useState("");
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedQuery(query.trim().toLowerCase());
    }, 80); // very small delay for smooth typing
    return () => clearTimeout(t);
  }, [query]);

  /* ---------- Home picks & immediate load (10 first) ---------- */
  useEffect(() => {
    setLoadingHome(true);

    const cats = Catalog.getCategories();
    if (!cats.length) {
      setHomeProducts([]);
      setVisibleProducts([]);
      setLoadingHome(false);
      return;
    }

    // pick a random category each load
    const randomCat = cats[Math.floor(Math.random() * cats.length)];
    const picks: IndexedProduct[] = [];

    randomCat.subcategories.forEach((sub) => {
      const valid = allProducts.filter(
        (p) => p.categorySlug === randomCat.slug && p.subcategorySlug === sub.slug
      );
      if (!valid.length) return;
      const shuffled = [...valid].sort(() => 0.5 - Math.random());
      picks.push(...shuffled.slice(0, 6));
    });

    const trending = picks.length ? picks : allProducts.slice();
    setHomeProducts(trending);
    setVisibleProducts(trending.slice(0, 10)); // instant 10
    setLoadingHome(false);
  }, [allProducts]);


  /* ---------- Infinite scroll for home / results (lazy) ---------- */
  useEffect(() => {
    function onScroll() {
      // lazy-load more home products
      if (
        window.innerHeight + window.scrollY >=
        document.body.offsetHeight - 200
      ) {
        setVisibleProducts((prev) => {
          const nextCount = prev.length + 20;
          return homeProducts.slice(0, nextCount);
        });
      }
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [homeProducts]);

  /* ---------- Suggestions (unique keys) ---------- */
  const suggestions = useMemo(() => {
    if (!debouncedQuery) return [];
    const cats = Catalog.getCategories();
    const out: Suggestion[] = [];

    cats.forEach((cat) => {
      if (cat.name.toLowerCase().includes(debouncedQuery)) {
        out.push({ type: "category", name: cat.name, slug: cat.slug });
      }
      cat.subcategories.forEach((sub) => {
        if (sub.name.toLowerCase().includes(debouncedQuery)) {
          out.push({
            type: "subcategory",
            name: sub.name,
            slug: sub.slug,
            parent: cat.slug,
          });
        }
      });
    });

    if (debouncedQuery.length >= 2) {
      fuse.search(debouncedQuery, { limit: 20 }).forEach((r, i) => {
        const p = r.item;
        out.push({
          type: "product",
          name: p.title,
          slug: p.id,
          parent: p.categorySlug,
          id: p.id,
          reactKey: `${p.id}-${p.subcategorySlug}-${i}`, // unique
        });
      });
    }

    const seen = new Set<string>();
    return out.filter((s, i) => {
      const key = `${s.type}:${s.parent ?? "root"}:${s.slug}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [debouncedQuery, fuse]);

  /* ---------- Search results & active filter/category/subcategory handling ---------- */
  const searchResults = useMemo<IndexedProduct[] | null>(() => {
    function dedupe(arr: IndexedProduct[]) {
      const seen = new Set<string>();
      return arr.filter((p) => {
        if (seen.has(p.id)) return false;
        seen.add(p.id);
        return true;
      });
    }
    function applySort(arr: IndexedProduct[]) {
      if (sortBy === "asc")
        return [...arr].sort((a, b) => Number(a.price) - Number(b.price));
      if (sortBy === "desc")
        return [...arr].sort((a, b) => Number(b.price) - Number(a.price));
      return arr;
    }

    if (activeFilter) {
      if (activeFilter.type === "category") {
        return applySort(
          dedupe(allProducts.filter((p) => p.categorySlug === activeFilter.slug))
        );
      }
      if (activeFilter.type === "subcategory") {
        return applySort(
          dedupe(
            allProducts.filter(
              (p) =>
                p.categorySlug === activeFilter.parent &&
                p.subcategorySlug === activeFilter.slug
            )
          )
        );
      }
      if (activeFilter.type === "product") {
        const exact = allProducts.find((p) => p.id === activeFilter.id);
        const related = allProducts
          .filter((p) => p.categorySlug === activeFilter.parent)
          .filter((p) =>
            p.title.toLowerCase().includes(activeFilter.name.toLowerCase())
          )
          .slice(0, 40);
        const combined: IndexedProduct[] = [];
        if (exact) combined.push(exact);
        combined.push(...related);
        return applySort(dedupe(combined));
      }
    }

    if (activeSubcategory && activeCategory) {
      return applySort(
        dedupe(
          allProducts.filter(
            (p) =>
              p.categorySlug === activeCategory.slug &&
              p.subcategorySlug === activeSubcategory.slug
          )
        )
      );
    }

    if (activeCategory) {
      return applySort(
        dedupe(allProducts.filter((p) => p.categorySlug === activeCategory.slug))
      );
    }

    if (debouncedQuery) {
      const matches =
        debouncedQuery.length >= 2
          ? fuse.search(debouncedQuery, { limit: 60 }).map((r) => r.item)
          : [];
      return applySort(dedupe(matches));
    }

    return null;
  }, [
    activeFilter,
    activeCategory,
    activeSubcategory,
    debouncedQuery,
    fuse,
    allProducts,
    sortBy,
  ]);

 const resetHome = useCallback(() => {
  // This should ONLY run when user clicks the custom Back button
  sessionStorage.removeItem("lastSearch"); // clear saved search
  setQuery("");
  setActiveFilter(null);
  setActiveCategory(null);
  setActiveSubcategory(null);
  setSortBy(null);
  setShowSuggestions(false);
  setShowBackButton(false);
  setVisibleProducts(homeProducts.slice(0, 10));
  if (typeof window !== "undefined") window.scrollTo({ behavior: "smooth" });
}, [homeProducts]);

  /* ---------- UX close suggestions on outside click/scroll ---------- */
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      const el = suggestionsRef.current;
      const inp = inputRef.current;
      if (!el || !inp) return;
      if (el.contains(e.target as Node) || inp.contains(e.target as Node)) return;
      setShowSuggestions(false);
    }
    function onScroll() {
      setShowSuggestions(false);
    }
    document.addEventListener("click", onDocClick);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      document.removeEventListener("click", onDocClick);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  /* ---------- drag handlers for category row ---------- */
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!catRowRef.current) return;
    isDown.current = true;
    startX.current = e.pageX - catRowRef.current.offsetLeft;
    scrollLeft.current = catRowRef.current.scrollLeft;
  };
  const handleMouseLeave = () => {
    isDown.current = false;
  };
  const handleMouseUp = () => {
    isDown.current = false;
  };
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDown.current || !catRowRef.current) return;
    e.preventDefault();
    const x = e.pageX - catRowRef.current.offsetLeft;
    const walk = (x - startX.current) * 1.5;
    catRowRef.current.scrollLeft = scrollLeft.current - walk;
  };

  /* ---------- suggestion select ---------- */
  function onSelectSuggestion(s: Suggestion) {
    setQuery(s.name);
    setActiveFilter(s);
    setActiveCategory(null);
    setActiveSubcategory(null);
    setShowSuggestions(false);
    setShowBackButton(true);

    // Save current search+scroll to sessionStorage so 'back' from product restores it
    if (typeof window !== "undefined") {
      sessionStorage.setItem(
        "lastSearch",
        JSON.stringify({
          query: s.name,
          scrollY: window.scrollY,
          activeFilter: s,
          activeCategorySlug: null,
          activeSubcategorySlug: null,
        } satisfies LastSearchState)
      );
    }

    window.scrollTo({ behavior: "smooth" });
  }

  /* ---------- product url ---------- */
  function productUrl(p: IndexedProduct) {
    return `/shop/${encodeURIComponent(p.categorySlug)}/${encodeURIComponent(
      p.subcategorySlug
    )}/${encodeURIComponent(p.id)}`;
  }

  /* ---------- helper for trending sort ---------- */
  function applyTrendingSort(arr: IndexedProduct[]) {
    if (sortBy === "asc") return [...arr].sort((a, b) => Number(a.price) - Number(b.price));
    if (sortBy === "desc") return [...arr].sort((a, b) => Number(b.price) - Number(a.price));
    return arr;
  }

  /* ---------- category click: auto-select first subcategory & lazy load ---------- */
  const handleCategoryClick = (cat: Category) => {
    setLoadingProducts(true);
    setActiveCategory(cat);
    // auto-select first subcategory (if exists) so products for it load by default
    setActiveSubcategory(cat.subcategories && cat.subcategories.length > 0 ? cat.subcategories[0] : null);
    setActiveFilter(null);
    setShowBackButton(true);
    // Save state to session so product->back can restore
    if (typeof window !== "undefined") {
     sessionStorage.setItem(
  "lastSearch",
  JSON.stringify({
    query: cat.name,
    scrollY: window.scrollY,
    activeFilter: null,
    activeCategorySlug: cat.slug,
    activeSubcategorySlug: cat.subcategories?.[0]?.slug ?? null,
  } satisfies LastSearchState)
);

    }
    setTimeout(() => setLoadingProducts(false), 200);
    window.scrollTo({ behavior: "smooth" });
  };

  const handleSubcategoryClick = (sub: Subcategory) => {
    setLoadingProducts(true);
    setActiveSubcategory(sub);
    setActiveFilter(null);
    setShowBackButton(true);
    if (typeof window !== "undefined") {
      sessionStorage.setItem(
      "lastSearch",
      JSON.stringify({
        query: sub.name,
        scrollY: window.scrollY,
        activeFilter: null,
        activeCategorySlug: activeCategory?.slug ?? null,
        activeSubcategorySlug: sub.slug,
      } satisfies LastSearchState)
    );
    }
    setTimeout(() => setLoadingProducts(false), 200);
    window.scrollTo({  behavior: "smooth" });
  };

  /* ---------- Enter key in search: close suggestions + show back icon ---------- */
  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      setShowSuggestions(false);
      setShowBackButton(true);

      if (typeof window !== "undefined") {
        sessionStorage.setItem(
          "lastSearch",
          JSON.stringify({
            query: query.trim(),
            scrollY: window.scrollY,
            activeFilter: null,
            activeCategorySlug: null,
            activeSubcategorySlug: null,
          } satisfies LastSearchState)
        );
      }
    }
  };

  /* ---------- persist & restore last search on back/forward ---------- */
  useEffect(() => {
    if (typeof window === "undefined") return;

    const restoreState = () => {
      const raw = sessionStorage.getItem("lastSearch");
      if (!raw) return;

      try {
        const parsed = JSON.parse(raw) as LastSearchState;
        if (!parsed) return;

        if (parsed.query) setQuery(parsed.query);
        if (parsed.activeFilter) setActiveFilter(parsed.activeFilter);

        if (parsed.activeCategorySlug) {
          const cat = Catalog.getCategories().find(
            (c) => c.slug === parsed.activeCategorySlug
          ) || null;
          setActiveCategory(cat);

          if (parsed.activeSubcategorySlug && cat) {
            const sub = cat.subcategories.find(
              (s) => s.slug === parsed.activeSubcategorySlug
            ) || null;
            setActiveSubcategory(sub);
          }
        }

        setShowBackButton(
          !!(parsed.query || parsed.activeFilter || parsed.activeCategorySlug)
        );

        // Restore scroll AFTER DOM updates and products are visible
        if (parsed.scrollY !== undefined) {
          const tryScroll = () => {
            if (document.body.offsetHeight > 0) {
              window.scrollTo({ top: parsed.scrollY, behavior: "auto" });
            } else {
              // wait until DOM renders
              requestAnimationFrame(tryScroll);
            }
          };
          requestAnimationFrame(tryScroll);
        }
      } catch {
        // ignore parse errors
      }
    };

  restoreState();
  window.addEventListener("popstate", restoreState);
  return () => window.removeEventListener("popstate", restoreState);
}, []);


  /* ---------- when clicking a product, save last search (so back restores) ---------- */
  const handleProductClickSave = (p: IndexedProduct) => {
    if (typeof window !== "undefined") {
      const saveQuery = debouncedQuery || query || activeFilter?.name || activeSubcategory?.name || activeCategory?.name || "";
      sessionStorage.setItem(
        "lastSearch",
        JSON.stringify({
          query: saveQuery,
          scrollY: window.scrollY,
          activeFilter,
          activeCategorySlug: activeCategory?.slug ?? null,
          activeSubcategorySlug: activeSubcategory?.slug ?? null,
        } satisfies LastSearchState)
      );
    }
  };

  /* ---------- fix for duplicate key console error: ensure unique keys for lists ---------- */
  const productKey = (p: IndexedProduct) => `${p.id}-${p.subcategorySlug}-${p.categorySlug}`;

  /* ---------- render ---------- */
  return (
    <HomeContext.Provider value={{ resetHome }}>
      <div className="space-y-6 p-4 pb-28">
        {/* Search Row */}
        <div className="flex items-center gap-3 w-full">
          {showBackButton ? (
            <button
              onClick={resetHome}
              aria-label="Back"
              className="flex items-center justify-center p-2 text-gray-700 hover:text-black transition"
            >
              <ArrowLeft className="w-6 h-6" />
            </button>
          ) : null}

          <div className="relative w-full">
            <input
              ref={inputRef}
              type="text"
              placeholder="Search for products, categories, subcategories..."
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setShowSuggestions(true);
                if (e.target.value.trim() === "") setActiveFilter(null);
              }}
              onKeyDown={handleSearchKeyDown}
              className="w-full rounded-2xl bg-white/90 backdrop-blur-lg border border-gray-200 px-5 py-3 
              text-gray-800 shadow-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 
              placeholder-gray-400 transition duration-200 ease-in-out"

            />

            {/* Suggestions dropdown */}
            {showSuggestions && suggestions.length > 0 && (
              <div
                ref={suggestionsRef}
                className="absolute z-20 mt-2 w-full rounded-2xl backdrop-blur-md bg-white/90 shadow-xl border border-gray-100 max-h-72 overflow-y-auto"
              >
                {suggestions.map((s, i) => (
                  <button
                    key={`${s.type}-${s.parent ?? "root"}-${s.slug}-${i}`}
                    type="button"
                    className="w-full text-left px-5 py-3 hover:bg-gray-100/70 flex items-center justify-between transition"
                    onClick={() => onSelectSuggestion(s)}
                  >
                    <span className="text-sm font-medium text-gray-900">{s.name}</span>
                    <span className="text-xs text-gray-500">
                      {s.type === "category"
                        ? "Category"
                        : s.type === "subcategory"
                        ? "Subcategory"
                        : "Product"}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>


        {/* Categories + Subcategories row — hidden during search */}
        {!debouncedQuery && !activeFilter && (
          <>
            {/* Categories row */}
            <div
              ref={catRowRef}
              className="overflow-x-auto hide-scrollbar py-2"
              onMouseDown={handleMouseDown}
              onMouseLeave={handleMouseLeave}
              onMouseUp={handleMouseUp}
              onMouseMove={handleMouseMove}
            >
              <div className="flex gap-4 min-w-max items-center">
                {Catalog.getCategories().map((cat) => {
                  const iconData = categoryIcons[cat.name];
                  const Icon = iconData?.icon;
                  const gradient = iconData?.gradient ?? "from-gray-400 to-gray-600";
                  return (
                    <motion.button
                      key={cat.slug}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => handleCategoryClick(cat)}
                      className={`flex flex-col items-center justify-center w-20 h-20 rounded-full text-white shadow-lg flex-shrink-0
                        bg-gradient-to-br ${gradient}
                        ${activeCategory?.slug === cat.slug ? "ring-4 ring-offset-2 ring-indigo-500" : ""}`}
                      title={cat.name}
                    >
                      {Icon ? <Icon className="w-8 h-8" /> : <div className="text-lg">{cat.name[0]}</div>}
                    </motion.button>
                  );
                })}
              </div>
            </div>

            {/* Subcategories (if category selected) */}
            {activeCategory && (
              <div className="flex flex-wrap gap-2 justify-center">
                {activeCategory.subcategories.map((sub) => {
                  const iconData =
                    categoryIcons[sub.name] ?? categoryIcons[activeCategory.name];
                  const Icon = iconData?.icon;
                  const gradient = iconData?.gradient ?? "from-gray-300 to-gray-400";
                  return (
                    <motion.button
                      key={sub.slug}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => handleSubcategoryClick(sub)}
                      className={`px-3 py-1 rounded-full text-sm font-medium text-white shadow bg-gradient-to-r ${gradient} ${
                        activeSubcategory?.slug === sub.slug
                          ? "ring-2 ring-offset-2 ring-indigo-500"
                          : ""
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        {Icon && <Icon className="w-4 h-4" />}
                        <span className="whitespace-nowrap">{sub.name}</span>
                      </div>
                    </motion.button>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* Controls (clear + price sort) */}
        <div className="flex justify-between items-center">
          <button onClick={resetHome} className="px-3 py-1 rounded bg-gray-200 hover:bg-gray-300">Clear</button>
          <div className="flex gap-2">
            <button onClick={() => setSortBy("asc")} className={`px-3 py-1 rounded ${sortBy === "asc" ? "bg-blue-600 text-white" : "bg-gray-200"}`}>Price ↑</button>
            <button onClick={() => setSortBy("desc")} className={`px-3 py-1 rounded ${sortBy === "desc" ? "bg-blue-600 text-white" : "bg-gray-200"}`}>Price ↓</button>
          </div>
        </div>

        {/* Results / Trending */}
        {loadingProducts ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={`loading-${i}`} className="h-44 animate-pulse bg-gray-200 rounded-lg" />
            ))}
          </div>
        ) : searchResults && searchResults.length > 0 ? (
          // SEARCH / FILTERED RESULTS (covers activeCategory / activeSubcategory / activeFilter / search)
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mt-4">
            {searchResults.map((p) => (
              <Link
                key={productKey(p)}
                href={productUrl(p)}
                onClick={() => handleProductClickSave(p)}
                className="block hover:scale-[1.02] transition"
              >
                <div className="relative w-full aspect-square mb-2 overflow-hidden rounded-lg">
                  <img src={p.mainImage ?? ""} alt={p.title} className="w-full h-full object-cover" loading="lazy" />
                </div>
                <div className="text-sm line-clamp-2">{p.title}</div>
                <div className="font-semibold mt-1">Rs {p.price}</div>
              </Link>
            ))}
          </div>
        ) : loadingHome ? (
          // initial skeleton while home loads
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={`skeleton-${i}`} className="h-44 animate-pulse bg-gray-200 rounded-lg" />
            ))}
          </div>
        ) : (
          // HOME / TRENDING
          <section>
            <h1 className="text-2xl font-semibold">🔥 Trending / Hot</h1>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mt-4">
              {applyTrendingSort(visibleProducts).map((p) => (
                <Link
                  key={productKey(p)}
                  href={productUrl(p)}
                  onClick={() => handleProductClickSave(p)}
                  className="block hover:scale-[1.02] transition"
                >
                  <div className="relative w-full aspect-square mb-2 overflow-hidden rounded-lg">
                    <img src={p.mainImage ?? ""} alt={p.title} className="w-full h-full object-cover" loading="lazy" />
                  </div>
                  <div className="text-sm line-clamp-2">{p.title}</div>
                  <div className="font-semibold mt-1">Rs {p.price}</div>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </HomeContext.Provider>
  );
}
