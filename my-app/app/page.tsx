// app/page.tsx
"use client";

import React, { useEffect, useMemo, useRef, useState, useLayoutEffect } from "react";
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

export default function HomePage() {
  const [query, setQuery] = useState("");
  const [showBackButton, setShowBackButton] = useState(false);

  const [loadingHome, setLoadingHome] = useState(true);

  const [homeProducts, setHomeProducts] = useState<IndexedProduct[]>([]);
  const [visibleHome, setVisibleHome] = useState<number>(6);

  const [visibleSearch, setVisibleSearch] = useState<number>(10);

  const inputRef = useRef<HTMLInputElement | null>(null);

  const [priceSort, setPriceSort] = useState<"asc" | "desc" | null>(null);

  /* ---------- Build product index ---------- */
  const allProducts = useMemo<IndexedProduct[]>(() => {
    const out: IndexedProduct[] = [];
    Catalog.getCategories().forEach((cat) => {
      cat.subcategories.forEach((sub) => {
        (sub.products || []).forEach((p: Product) => {
          const mainImage =
            p.img ??
            (Array.isArray((p as any).images) ? (p as any).images[0] : null);
          if (!mainImage) return;
          const priceNum = Number(p.price) || 0;
          if (priceNum <= 0) return;
          out.push({
            ...(p as IndexedProduct),
            categorySlug: cat.slug,
            subcategorySlug: sub.slug,
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
      threshold: 0.4,
      ignoreLocation: true,
      minMatchCharLength: 1,
    });
  }, [allProducts]);

  /* ---------- Debounced query ---------- */
  const [debouncedQuery, setDebouncedQuery] = useState("");
  useEffect(() => {
    const t = setTimeout(
      () => setDebouncedQuery(query.trim().toLowerCase()),
      60
    );
    return () => clearTimeout(t);
  }, [query]);

  /* ---------- Home picks ---------- */
  useEffect(() => {
    setLoadingHome(true);
    const cats = Catalog.getCategories();
    const picks: IndexedProduct[] = [];

    cats.forEach((cat) => {
      cat.subcategories.forEach((sub) => {
        const valid = allProducts.filter(
          (p) => p.categorySlug === cat.slug && p.subcategorySlug === sub.slug
        );
        if (valid.length) {
          const random = valid[Math.floor(Math.random() * valid.length)];
          picks.push(random);
        }
      });
    });

    setHomeProducts(shuffle(picks));
    setLoadingHome(false);
  }, [allProducts]);

  /* ---------- Search results ---------- */
  const searchResults = useMemo<IndexedProduct[]>(() => {
    if (!debouncedQuery) return [];
    const matches = fuse.search(debouncedQuery, { limit: 200 }).map((r) => r.item);

    const deduped = Array.from(new Map(matches.map((m) => [m.id, m])).values());

    if (priceSort) {
      deduped.sort((a, b) => {
        const pa = Number(a.price) || 0;
        const pb = Number(b.price) || 0;
        return priceSort === "asc" ? pa - pb : pb - pa;
      });
    }

    return deduped;
  }, [debouncedQuery, fuse, priceSort]);

  /* ---------- Reset Home ---------- */
  const resetHome = () => {
    setQuery("");
    setShowBackButton(false);
    setPriceSort(null);
    setVisibleSearch(10);
    sessionStorage.removeItem("lastQuery");
    sessionStorage.removeItem("scrollY");
    sessionStorage.removeItem("visibleSearch");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  /* ---------- product url ---------- */
  function productUrl(p: IndexedProduct) {
    return `/shop/${encodeURIComponent(p.categorySlug)}/${encodeURIComponent(
      p.subcategorySlug
    )}/${encodeURIComponent(p.id)}`;
  }

  /* ---------- Restore state on back from product ---------- */
  useEffect(() => {
    const lastQ = sessionStorage.getItem("lastQuery");
    const lastScroll = sessionStorage.getItem("scrollY");
    const lastVisible = sessionStorage.getItem("visibleSearch");
    if (lastQ) {
      setQuery(lastQ);
      setShowBackButton(true);
    }
    if (lastVisible) {
      setVisibleSearch(Number(lastVisible));
    }
    if (lastScroll) {
      // Save scrollY for later after DOM updates
      (window as any).__restoreScrollY = Number(lastScroll);
    }
  }, []);

  /* ---------- Ensure scroll happens AFTER results paint ---------- */
  useLayoutEffect(() => {
    if ((window as any).__restoreScrollY != null && searchResults.length > 0) {
      const y = (window as any).__restoreScrollY;
      delete (window as any).__restoreScrollY;
      setTimeout(() => {
        window.scrollTo({ top: y, behavior: "instant" as ScrollBehavior });
      }, 0);
    }
  }, [searchResults, visibleSearch]);

  /* ---------- render ---------- */
  return (
    <HomeContext.Provider value={{ resetHome }}>
      <div className="space-y-6 p-4 pb-28">
        {/* Search Row */}
        <div className="flex items-center gap-3 w-full">
          {showBackButton && (
            <button
              onClick={resetHome}
              aria-label="Back"
              className="flex items-center justify-center p-2 text-gray-700 hover:text-black transition"
            >
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
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  inputRef.current?.blur();
                  setShowBackButton(true);
                  sessionStorage.setItem("lastQuery", query);
                }
              }}
              className="w-full rounded-2xl bg-white/90 border px-5 py-3 
              text-gray-800 shadow-lg focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        {/* Search results */}
        {debouncedQuery ? (
          <>
            <div className="flex items-center gap-3 mb-4">
              <button
                onClick={() => setPriceSort("asc")}
                className={`px-4 py-2 rounded-lg border text-sm ${
                  priceSort === "asc"
                    ? "bg-indigo-600 text-white"
                    : "bg-white text-gray-700"
                }`}
              >
                Price ↑
              </button>
              <button
                onClick={() => setPriceSort("desc")}
                className={`px-4 py-2 rounded-lg border text-sm ${
                  priceSort === "desc"
                    ? "bg-indigo-600 text-white"
                    : "bg-white text-gray-700"
                }`}
              >
                Price ↓
              </button>
              {priceSort && (
                <button
                  onClick={() => setPriceSort(null)}
                  className="px-4 py-2 rounded-lg border text-sm bg-white text-gray-500"
                >
                  Reset
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              {searchResults.slice(0, visibleSearch).map((p) => (
                <Link
                  key={p.id}
                  href={productUrl(p)}
                  onClick={() => {
                    sessionStorage.setItem("scrollY", String(window.scrollY));
                    sessionStorage.setItem("lastQuery", query);
                    sessionStorage.setItem("visibleSearch", String(visibleSearch));
                  }}
                  className="block hover:scale-[1.02] transition"
                >
                  <div className="relative w-full aspect-square mb-2 overflow-hidden rounded-lg">
                    <img
                      src={p.mainImage ?? ""}
                      alt={p.title}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  </div>
                  <div className="text-sm line-clamp-2">{p.title}</div>
                  <div className="font-semibold mt-1">Rs {p.price}</div>
                </Link>
              ))}
            </div>

            {visibleSearch < searchResults.length && (
              <div className="flex justify-center mt-6">
                <button
                  onClick={() => {
                    const next = visibleSearch + 20;
                    setVisibleSearch(next);
                    sessionStorage.setItem("visibleSearch", String(next));
                  }}
                  className="px-6 py-3 rounded-xl bg-indigo-600 text-white shadow hover:bg-indigo-700 transition"
                >
                  Load more
                </button>
              </div>
            )}
          </>
        ) : loadingHome ? (
          <p className="text-center text-gray-500 py-10">Loading...</p>
        ) : (
          <section>
            <h1 className="text-2xl font-semibold">🔥 Hot Picks</h1>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mt-4">
              {homeProducts.slice(0, visibleHome).map((p) => (
                <Link
                  key={p.id}
                  href={productUrl(p)}
                  onClick={() => {
                    sessionStorage.setItem("scrollY", String(window.scrollY));
                  }}
                  className="block hover:scale-[1.02] transition"
                >
                  <div className="relative w-full aspect-square mb-2 overflow-hidden rounded-lg">
                    <img
                      src={p.mainImage ?? ""}
                      alt={p.title}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  </div>
                  <div className="text-sm line-clamp-2">{p.title}</div>
                  <div className="font-semibold mt-1">Rs {p.price}</div>
                </Link>
              ))}
            </div>

            {visibleHome < homeProducts.length && (
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
