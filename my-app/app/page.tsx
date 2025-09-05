// app/page.tsx
"use client";

import {
  useEffect,
  useMemo,
  useState,
  useDeferredValue,
  useCallback,
} from "react";
import Link from "next/link";
import Fuse from "fuse.js";
import Catalog, { Product, Category, Subcategory } from "./lib/catalog";
import { HomeContext } from "./lib/HomeContext";

type Suggestion = {
  type: "category" | "subcategory";
  name: string;
  slug: string;
  parent?: string;
  reactKey?: string; // only for React rendering
};

export default function Home() {
  const [query, setQuery] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(true);
  const [homeProducts, setHomeProducts] = useState<Product[]>([]);
  const [visibleProducts, setVisibleProducts] = useState<Product[]>([]);
  const [loadingHome, setLoadingHome] = useState(true);
  const [activeFilter, setActiveFilter] = useState<Suggestion | null>(null);

  // ✅ Reset home from BottomNav
  const resetHome = useCallback(() => {
    setQuery("");
    setActiveFilter(null);
    setShowSuggestions(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  // ✅ Precompute all categories + subcategories as search targets
  const searchTargets: Suggestion[] = useMemo(() => {
    const cats = Catalog.getCategories();
    const targets: Suggestion[] = [];
    cats.forEach((cat: Category) => {
      targets.push({ type: "category", name: cat.name, slug: cat.slug });
      cat.subcategories.forEach((sub: Subcategory) => {
        targets.push({
          type: "subcategory",
          name: sub.name,
          slug: sub.slug,
          parent: cat.slug,
        });
      });
    });
    return targets;
  }, []);

  // 🎯 Fuzzy search instance (runs once)
  const fuse = useMemo(() => {
    return new Fuse(searchTargets, {
      keys: ["name"],
      threshold: 0.4,
    });
  }, [searchTargets]);

  // 🎲 Home products = many random picks
  useEffect(() => {
    setLoadingHome(true);

    const picks: Product[] = [];
    Catalog.getCategories().forEach((cat) => {
      cat.subcategories.forEach((sub) => {
        if (!sub.products?.length) return;
        const shuffled = [...sub.products].sort(() => 0.5 - Math.random());
        picks.push(...shuffled.slice(0, 6)); // more variety
      });
    });

    setHomeProducts(picks);
    setVisibleProducts(picks.slice(0, 30)); // show 30 instantly
    const t = setTimeout(() => setLoadingHome(false), 300);
    return () => clearTimeout(t);
  }, []);

  // ♻️ Infinite scroll: load 20 more when scrolled near bottom
  useEffect(() => {
    function onScroll() {
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
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, [homeProducts]);

  // 🕒 Defer query for smooth typing
  const deferredQuery = useDeferredValue(query.trim().toLowerCase());

  // ✅ Suggestions via fuzzy search
  const suggestions = useMemo(() => {
    if (!deferredQuery) return [];
    return fuse.search(deferredQuery).map((r, idx) => ({
      ...r.item,
      reactKey: `${r.item.type}-${r.item.parent ?? "root"}-${r.item.slug}-${idx}`,
    }));
  }, [deferredQuery, fuse]);

  // ✅ Search results = products under selected category/subcategory
  const searchResults: Product[] | null = useMemo(() => {
    if (!activeFilter) return null;
    if (activeFilter.type === "category") {
      return Catalog.getProducts(activeFilter.slug);
    } else {
      return Catalog.getProducts(activeFilter.parent, activeFilter.slug);
    }
  }, [activeFilter]);

  // 🔗 Helper: build product URL
  function productUrl(p: Product & { category?: string; subcategory?: string }) {
    const cat = (p as any).category ?? activeFilter?.parent ?? "";
    const sub =
      (p as any).subcategory ??
      (activeFilter?.type === "subcategory" ? activeFilter.slug : "");
    return `/shop/${encodeURIComponent(cat)}/${encodeURIComponent(
      sub
    )}/${encodeURIComponent(p.id)}`;
  }

  return (
    <HomeContext.Provider value={{ resetHome }}>
      <div className="space-y-6 p-4 pb-20">
        {/* 🔍 Search Bar */}
        <div className="relative">
          <input
            type="text"
            placeholder="Search Products…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setShowSuggestions(true);
              if (e.target.value.trim() === "") {
                setActiveFilter(null);
              }
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && suggestions[0]) {
                setActiveFilter(suggestions[0]);
                setShowSuggestions(false);
              }
            }}
            className="w-full rounded-xl border p-3 shadow focus:outline-none"
          />
          {showSuggestions && suggestions.length > 0 && (
            <div className="absolute z-10 mt-1 w-full bg-white shadow rounded-lg max-h-60 overflow-y-auto">
              {suggestions.map((s) => (
                <button
                  key={s.reactKey}
                  type="button"
                  className="w-full text-left p-2 hover:bg-gray-100 cursor-pointer"
                  onClick={() => {
                    setQuery(s.name);
                    setActiveFilter(s);
                    setShowSuggestions(false);
                  }}
                >
                  {s.name}{" "}
                  {s.type === "subcategory" && (
                    <span className="text-xs text-gray-500">(subcategory)</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Search Results or Trending */}
        {searchResults ? (
          <section>
            <h2 className="text-xl font-semibold mb-2">
              {activeFilter?.name} – Products
            </h2>
            {searchResults.length === 0 ? (
              <p className="text-gray-500">No products found.</p>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {searchResults.map((p) => (
                  <Link
                    key={p.id}
                    href={productUrl(p as any)}
                    className="rounded-xl shadow p-2 bg-white block"
                  >
                    {p.img && (
                      <div className="relative w-full aspect-square mb-2">
                        <img
                          src={p.img}
                          alt={p.title}
                          className="w-full h-full object-cover rounded-lg"
                          loading="lazy"
                        />
                      </div>
                    )}
                    <div className="text-sm line-clamp-2">{p.title}</div>
                    <div className="font-semibold mt-1">
                      {p.price ? `Rs ${p.price}` : "Price N/A"}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>
        ) : (
          <section>
            <h1 className="text-2xl font-semibold">Trending / Hot</h1>
            {loadingHome ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-2">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div
                    key={i}
                    className="rounded-xl shadow p-2 bg-gray-200 h-40 animate-pulse"
                  />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-2">
                {visibleProducts.map((p) => (
                  <Link
                    key={p.id}
                    href={productUrl(p as any)}
                    className="rounded-xl shadow p-2 bg-white block"
                  >
                    {p.img && (
                      <div className="relative w-full aspect-square mb-2">
                        <img
                          src={p.img}
                          alt={p.title}
                          className="w-full h-full object-cover rounded-lg"
                          loading="lazy"
                        />
                      </div>
                    )}
                    <div className="text-sm line-clamp-2">{p.title}</div>
                    <div className="font-semibold mt-1">
                      {p.price ? `Rs ${p.price}` : "Price N/A"}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>
        )}
      </div>
    </HomeContext.Provider>
  );
}
