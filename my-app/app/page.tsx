// app/page.tsx
"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Catalog, { Product, Category, Subcategory } from "./lib/catalog";

export default function Home() {
  // ✅ Use Catalog default export functions
  const trending: Product[] = Catalog.getTrending();
  const allProducts: Product[] = Catalog.getProducts();
  const categories: Category[] = Catalog.getCategories();

  const [query, setQuery] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(true);

  // ✅ Suggestions for dropdown
  const suggestions: Product[] = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return allProducts
      .filter((p) => p.title.toLowerCase().includes(q))
      .slice(0, 8);
  }, [query, allProducts]);

  // ✅ Full search results
  const searchResults: Product[] | null = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return null;
    return allProducts.filter((p) => p.title.toLowerCase().includes(q));
  }, [query, allProducts]);

  // ✅ Subcategories (2 products each)
  const subcategoryBlocks = useMemo(() => {
    const blocks: { key: string; title: string; products: Product[] }[] = [];
    categories.forEach((cat: Category) => {
      (cat.subcategories ?? []).forEach((sub: Subcategory) => {
        const prods = (sub.products ?? []).slice(0, 2);
        if (prods.length) {
          blocks.push({
            key: `${cat.name}::${sub.name}`,
            title: sub.name,
            products: prods,
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
                  href={`/shop/${p.id}`}
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
                  href={`/shop/${p.id}`}
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

          {/* Subcategories (2 products each) */}
          <section className="space-y-6">
            {subcategoryBlocks.map((block) => (
              <div key={block.key}>
                <h2 className="text-xl font-semibold mb-2">{block.title}</h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {block.products.map((p) => (
                    <Link
                      key={p.id}
                      href={`/shop/${p.id}`}
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
              </div>
            ))}
          </section>
        </>
      )}
    </div>
  );
}
