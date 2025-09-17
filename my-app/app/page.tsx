"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import Fuse from "fuse.js";
import Catalog, { Product, Category, Subcategory } from "./lib/catalog";
import { HomeContext } from "./lib/HomeContext";
import { categoryIcons } from "./lib/categoryIcons";
import Image from "next/image";

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

/* ----------------- component ----------------- */
export default function HomePage() {
  const [query, setQuery] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(true);

  const [homeProducts, setHomeProducts] = useState<IndexedProduct[]>([]);
  const [visibleProducts, setVisibleProducts] = useState<IndexedProduct[]>([]);
  const [loadingHome, setLoadingHome] = useState(true);
  const [loadingProducts, setLoadingProducts] = useState(false); // new loading flag

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

  /* ---------- Fuse instance ---------- */
  const fuse = useMemo(() => {
    return new Fuse(allProducts, {
      keys: ["title"],
      threshold: 0.35,
      ignoreLocation: true,
      minMatchCharLength: 2,
    });
  }, [allProducts]);

  /* ---------- Debounced query ---------- */
  const [debouncedQuery, setDebouncedQuery] = useState("");
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedQuery(query.trim().toLowerCase());
    }, 120);
    return () => clearTimeout(t);
  }, [query]);

  /* ---------- Trending / hot picks ---------- */
  useEffect(() => {
    setLoadingHome(true);
    const picks: IndexedProduct[] = [];
    const cats = Catalog.getCategories();
    cats.forEach((cat) => {
      cat.subcategories.forEach((sub) => {
        const valid = allProducts.filter(
          (p) => p.categorySlug === cat.slug && p.subcategorySlug === sub.slug
        );
        if (!valid.length) return;
        const shuffled = [...valid].sort(() => 0.5 - Math.random());
        picks.push(...shuffled.slice(0, 6));
      });
    });
    const trending = picks.length ? picks : allProducts.slice();
    setHomeProducts(trending);
    setVisibleProducts(trending.slice(0, 30));
    const t = setTimeout(() => setLoadingHome(false), 200);
    return () => clearTimeout(t);
  }, [allProducts]);

  /* ---------- Infinite scroll ---------- */
  useEffect(() => {
    function onScroll() {
      if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 200) {
        setVisibleProducts((prev) => {
          const nextCount = prev.length + 20;
          return homeProducts.slice(0, nextCount);
        });
      }
    }
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, [homeProducts]);

  /* ---------- Suggestions ---------- */
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
      fuse.search(debouncedQuery, { limit: 20 }).forEach((r) => {
        const p = r.item;
        out.push({
          type: "product",
          name: p.title,
          slug: p.id,
          parent: p.categorySlug,
          id: p.id,
        });
      });
    }

    const seen = new Set<string>();
    return out.filter((s) => {
      const key = `${s.type}:${s.parent ?? "root"}:${s.slug}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [debouncedQuery, fuse]);

  /* ---------- Search results ---------- */
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
      if (sortBy === "asc") return [...arr].sort((a, b) => Number(a.price) - Number(b.price));
      if (sortBy === "desc") return [...arr].sort((a, b) => Number(b.price) - Number(a.price));
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
        const combined = [];
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
  }, [activeFilter, activeCategory, activeSubcategory, debouncedQuery, fuse, allProducts, sortBy]);

  /* ---------- reset home ---------- */
  const resetHome = useCallback(() => {
    setQuery("");
    setActiveFilter(null);
    setActiveCategory(null);
    setActiveSubcategory(null);
    setSortBy(null);
    setShowSuggestions(false);
    setVisibleProducts(homeProducts.slice(0, 30));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [homeProducts]);

  /* ---------- UX close suggestions ---------- */
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

  /* ---------- drag handlers ---------- */
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!catRowRef.current) return;
    isDown.current = true;
    startX.current = e.pageX - catRowRef.current.offsetLeft;
    scrollLeft.current = catRowRef.current.scrollLeft;
  };
  const handleMouseLeave = () => { isDown.current = false; };
  const handleMouseUp = () => { isDown.current = false; };
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
    window.scrollTo({ top: 300, behavior: "smooth" });
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

  /* ---------- category click ---------- */
  const handleCategoryClick = (cat: Category) => {
    setLoadingProducts(true);
    setActiveCategory(cat);
    setActiveSubcategory(null);
    setActiveFilter(null);
    setTimeout(() => setLoadingProducts(false), 250); // small loading animation
    window.scrollTo({ top: 220, behavior: "smooth" });
  };

  const handleSubcategoryClick = (sub: Subcategory) => {
    setLoadingProducts(true);
    setActiveSubcategory(sub);
    setActiveFilter(null);
    setTimeout(() => setLoadingProducts(false), 250); // small loading animation
    window.scrollTo({ top: 340, behavior: "smooth" });
  };

  /* ---------- render ---------- */
  return (
    <HomeContext.Provider value={{ resetHome }}>
      <div className="space-y-6 p-4 pb-28">
        {/* Search */}
        <div className="relative">
          <input
            ref={inputRef}
            type="text"
            placeholder="Search products, categories, subcategories..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setShowSuggestions(true);
              if (e.target.value.trim() === "") setActiveFilter(null);
            }}
            className="w-full rounded-xl border p-3 shadow focus:outline-none"
          />
          {showSuggestions && suggestions.length > 0 && (
            <div
              ref={suggestionsRef}
              className="absolute z-20 mt-1 w-full bg-white shadow-lg rounded-lg max-h-64 overflow-y-auto"
            >
              {suggestions.map((s) => (
                <button
                  key={s.reactKey ?? s.slug}
                  type="button"
                  className="w-full text-left p-3 hover:bg-gray-100 flex items-center gap-2"
                  onClick={() => onSelectSuggestion(s)}
                >
                  <div className="text-sm font-medium grow">{s.name}</div>
                  <div className="text-xs text-gray-500">
                    {s.type === "category" ? "Category" : s.type === "subcategory" ? "Subcategory" : "Product"}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

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

        {/* Subcategories */}
        {activeCategory && (
          <div className="flex flex-wrap gap-2 justify-center">
            {activeCategory.subcategories.map((sub) => {
              const iconData = categoryIcons[sub.name] ?? categoryIcons[activeCategory.name];
              const Icon = iconData?.icon;
              const gradient = iconData?.gradient ?? "from-gray-300 to-gray-400";
              return (
                <motion.button
                  key={sub.slug}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => handleSubcategoryClick(sub)}
                  className={`px-3 py-1 rounded-full text-sm font-medium text-white shadow
                    bg-gradient-to-r ${gradient}
                    ${activeSubcategory?.slug === sub.slug ? "ring-2 ring-offset-2 ring-indigo-500" : ""}`}
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

        {/* Controls */}
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
              <div key={i} className="rounded-xl shadow p-3 bg-gray-200 h-44 animate-pulse" />
            ))}
          </div>
        ) : searchResults && searchResults.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
            {searchResults.map((p) => (
              <Link
                key={p.id}
                href={productUrl(p)}
                className="rounded-xl shadow p-3 bg-white block hover:scale-[1.02] transition"
              >
                <div className="relative w-full aspect-square mb-2 overflow-hidden rounded-lg bg-gray-100">
                  <Image src={p.mainImage ?? ""} alt={p.title} className="w-full h-full object-cover" loading="lazy" />
                </div>
                <div className="text-sm line-clamp-2">{p.title}</div>
                <div className="font-semibold mt-1">Rs {p.price}</div>
              </Link>
            ))}
          </div>
        ) : loadingHome ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="rounded-xl shadow p-3 bg-gray-200 h-44 animate-pulse" />
            ))}
          </div>
        ) : (
          <section>
            <h1 className="text-2xl font-semibold">🔥 Trending / Hot</h1>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
              {applyTrendingSort(visibleProducts).map((p) => (
                <Link key={p.id} href={productUrl(p)} className="rounded-xl shadow p-3 bg-white block hover:scale-[1.02] transition">
                  <div className="relative w-full aspect-square mb-2 overflow-hidden rounded-lg bg-gray-100">
                    <Image src={p.mainImage ?? ""} alt={p.title} className="w-full h-full object-cover" loading="lazy" />
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
