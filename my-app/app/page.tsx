"use client";

import { useMemo, useState, useEffect } from "react";
import Link from "next/link";
import Catalog, { Product, Category, Subcategory } from "./lib/catalog";

// ✅ Build product link
function productUrl(p: Product): string {
  for (const cat of Catalog.getCategories()) {
    for (const sub of cat.subcategories ?? []) {
      if (sub.products?.some((x) => x.id === p.id)) {
        return `/shop/${cat.name.trim().replace(/\s+/g, "-")}/${sub.name
          .trim()
          .replace(/\s+/g, "-")}/${p.id}`;
      }
    }
  }
  return `/shop/${p.id}`;
}

// ✅ Build subcategory link
function subcategoryUrl(cat: Category, sub: Subcategory): string {
  return `/shop/${cat.name.trim().replace(/\s+/g, "-")}/${sub.name
    .trim()
    .replace(/\s+/g, "-")}`;
}

export default function Home() {
  const trending: Product[] = Catalog.getTrending();
  const allProducts: Product[] = Catalog.getProducts();
  const categories: Category[] = Catalog.getCategories();

  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(true);

  // ✅ Debounce search (fast on mobile)
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 200);
    return () => clearTimeout(t);
  }, [query]);

  // ✅ Suggestions (only when >= 2 chars)
  const suggestions: Product[] = useMemo(() => {
    const q = debouncedQuery.trim().toLowerCase();
    if (q.length < 2) return [];
    return allProducts.filter((p) =>
      p.title.toLowerCase().includes(q)
    ).slice(0, 8);
  }, [debouncedQuery, allProducts]);

  // ✅ Full search results
  const searchResults: Product[] | null = useMemo(() => {
    const q = debouncedQuery.trim().toLowerCase();
    if (!q) return null;
    return allProducts.filter((p) => p.title.toLowerCase().includes(q));
  }, [debouncedQuery, allProducts]);

  // ✅ Subcategories (25 products each, horizontal scroll)
  const subcategoryBlocks = useMemo(() => {
    const blocks: {
      key: string;
      title: string;
      products: Product[];
      url: string;
    }[] = [];
    categories.forEach((cat: Category) => {
      (cat.subcategories ?? []).forEach((sub: Subcategory) => {
        const prods = (sub.products ?? []).slice(0, 25);
        if (prods.length) {
          blocks.push({
            key: `${cat.name}::${sub.name}`,
            title: sub.name,
            products: prods,
            url: subcategoryUrl(cat, sub),
          });
        }
      });
    });
    return blocks;
  }, [categories]);

  return (
    <div className="space-y-6 p-4">
      {/* 🔍 Search Bar */}
      <div className="relative">
        <input
          type="text"
          placeholder="Search products…"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setShowSuggestions(true);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              setShowSuggestions(false);
            }
          }}
          className="w-full rounded-xl border p-3 shadow focus:outline-none"
        />
        {showSuggestions && suggestions.length > 0 && (
          <div className="absolute z-10 mt-1 w-full bg-white shadow rounded-lg max-h-60 overflow-y-auto">
            {suggestions.map((s) => (
              <button
                key={s.id}
                type="button"
                className="w-full text-left p-2 hover:bg-gray-100 cursor-pointer"
                onClick={() => {
                  setQuery(s.title);
                  setShowSuggestions(false);
                }}
              >
                {s.title}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Show search results if query exists */}
      {searchResults ? (
        <section>
          <h2 className="text-xl font-semibold mb-2">Search Results</h2>
          {searchResults.length === 0 ? (
            <p className="text-gray-500">No products found.</p>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {searchResults.map((p) => (
                <Link
                  key={p.id}
                  href={productUrl(p)}
                  className="rounded-xl shadow p-2 bg-white block"
                >
                  {p.img && (
                    <div className="relative w-full aspect-square mb-2">
                      <img
                        src={p.img}
                        alt={p.title}
                        className="w-full h-full object-cover rounded-lg"
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
        <>
          {/* Trending / Hot */}
          <section>
            <h1 className="text-2xl font-semibold">Trending / Hot</h1>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-2">
              {trending.map((p) => (
                <Link
                  key={p.id}
                  href={productUrl(p)}
                  className="rounded-xl shadow p-2 bg-white block"
                >
                  {p.img && (
                    <div className="relative w-full aspect-square mb-2">
                      <img
                        src={p.img}
                        alt={p.title}
                        className="w-full h-full object-cover rounded-lg"
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
          </section>

          {/* Subcategories (horizontal scroll + "Show more" card) */}
          <section className="space-y-10">
            {subcategoryBlocks.map((block) => (
              <div key={block.key}>
                <h2 className="text-xl font-semibold mb-2">{block.title}</h2>
                <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
                  {block.products.map((p) => (
                    <Link
                      key={p.id}
                      href={productUrl(p)}
                      className="min-w-[150px] max-w-[180px] rounded-xl shadow p-2 bg-white flex-shrink-0"
                    >
                      {p.img && (
                        <div className="relative w-full aspect-square mb-2">
                          <img
                            src={p.img}
                            alt={p.title}
                            className="w-full h-full object-cover rounded-lg"
                          />
                        </div>
                      )}
                      <div className="text-sm line-clamp-2">{p.title}</div>
                      <div className="font-semibold mt-1">
                        {p.price ? `Rs ${p.price}` : "Price N/A"}
                      </div>
                    </Link>
                  ))}

                  {/* Show more card */}
                  <Link
                    href={block.url}
                    className="min-w-[150px] max-w-[180px] flex items-center justify-center text-blue-600 font-medium border rounded-xl bg-white shadow flex-shrink-0"
                  >
                    Show more →
                  </Link>
                </div>
              </div>
            ))}
          </section>
        </>
      )}
    </div>
  );
}
