// shop/products/[category]/[subcategory]/page.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { use } from "react"; // unwrap params
import { useRouter } from "next/navigation";
import Link from "next/link";
import Catalog, { Product } from "@/app/lib/catalog";
import { ArrowLeft, XCircle } from "lucide-react";

type IndexedProduct = Product & {
  mainImage: string;
  price: string;
};

interface Props {
  params: Promise<{
    category: string;
    subcategory: string;
  }>;
}

const makeStorageKey = (cat: string, sub: string) =>
  `subcategory_state_${cat}_${sub}`;

export default function SubcategoryPage(props: Props) {
  const { category: categorySlug, subcategory: subcategorySlug } = use(
    props.params
  );
  const router = useRouter();

  const category = Catalog.getCategories().find((c) => c.slug === categorySlug);
  const subcategory = category?.subcategories.find(
    (s) => s.slug === subcategorySlug
  );

  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"asc" | "desc" | null>(null);
  const [visibleCount, setVisibleCount] = useState(20);

  // restore state + scroll
  useEffect(() => {
    const key = makeStorageKey(categorySlug, subcategorySlug);
    const saved = sessionStorage.getItem(key);
    if (saved) {
      const parsed = JSON.parse(saved);
      setSearchQuery(parsed.searchQuery || "");
      setSortBy(parsed.sortBy || null);
      setVisibleCount(parsed.visibleCount || 20);

      // always restore scroll if it exists
      if (parsed.scrollY) {
        setTimeout(() => window.scrollTo(0, parsed.scrollY), 50);
      }
    }
  }, [categorySlug, subcategorySlug]);

  const allProducts: IndexedProduct[] = useMemo(() => {
    if (!subcategory) return [];
    return (subcategory.products || [])
      .map((p) => {
        const mainImage =
          (p as any).img ??
          (Array.isArray((p as any).images) ? (p as any).images[0] : null);
        const priceNum = p.price ? Number(p.price) : 0;
        if (!mainImage || !priceNum) return null;
        return { ...p, mainImage, price: String(priceNum) };
      })
      .filter(Boolean) as IndexedProduct[];
  }, [subcategory]);

  const filteredProducts = useMemo(() => {
    let filtered = [...allProducts];
    if (searchQuery.trim().length > 0) {
      filtered = filtered.filter((p) =>
        p.title.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    if (sortBy === "asc")
      filtered.sort((a, b) => Number(a.price) - Number(b.price));
    else if (sortBy === "desc")
      filtered.sort((a, b) => Number(b.price) - Number(a.price));
    return filtered;
  }, [allProducts, searchQuery, sortBy]);

  const visibleProducts = filteredProducts.slice(0, visibleCount);

  if (!category || !subcategory)
    return <div className="p-6">Subcategory not found.</div>;

  return (
    <div className="p-4 sm:p-6">
      {/* Back + Title */}
      <div className="flex items-center justify-center relative mb-6">
        <button
          onClick={() => {
            // clear saved state if user explicitly leaves via back button
            const key = makeStorageKey(categorySlug, subcategorySlug);
            sessionStorage.removeItem(key);
            router.back();
          }}
          className="absolute left-0 p-2 rounded-full hover:bg-gray-100 transition"
        >
          <ArrowLeft size={24} className="text-black" />
        </button>
        <h1 className="text-2xl sm:text-3xl font-bold">{subcategory.name}</h1>
      </div>

      {/* Search + Sort + Count */}
      <div className="flex flex-col md:flex-row items-center justify-between mb-6 gap-3 w-full">
        <div className="relative flex-1 w-full">
          <input
            type="text"
            placeholder="Search in this subcategory..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setVisibleCount(20);
            }}
            className="w-full rounded-xl border px-4 py-3 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <XCircle size={20} />
            </button>
          )}
        </div>

        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-gray-600">
            {filteredProducts.length} products
          </span>
          <button
            className={`px-3 py-1 rounded-lg transition ${
              sortBy === "asc" ? "bg-blue-600 text-white" : "bg-gray-200"
            }`}
            onClick={() => setSortBy("asc")}
          >
            Price ↑
          </button>
          <button
            className={`px-3 py-1 rounded-lg transition ${
              sortBy === "desc" ? "bg-blue-600 text-white" : "bg-gray-200"
            }`}
            onClick={() => setSortBy("desc")}
          >
            Price ↓
          </button>
          {(searchQuery || sortBy) && (
            <button
              onClick={() => {
                setSearchQuery("");
                setSortBy(null);
                setVisibleCount(20);
              }}
              className="ml-2 px-3 py-1 rounded-lg bg-red-500 text-white hover:bg-red-600 transition"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Products */}
      {visibleProducts.length === 0 ? (
        <div className="text-center text-gray-500 mt-10">No products found.</div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
            {visibleProducts.map((p) => (
              <Link
                key={p.id}
                href={`/shop/${encodeURIComponent(category.slug)}/${encodeURIComponent(
                  subcategory.slug
                )}/${encodeURIComponent(p.id)}`}
                onClick={() => {
                  // Save filters + scroll before navigating
                  const key = makeStorageKey(categorySlug, subcategorySlug);
                  sessionStorage.setItem(
                    key,
                    JSON.stringify({
                      searchQuery,
                      sortBy,
                      visibleCount,
                      scrollY: window.scrollY,
                    })
                  );
                }}
                className="flex flex-col bg-white/0 rounded-xl border border-gray-200 shadow-md hover:shadow-lg hover:scale-[1.02] transition-transform overflow-hidden"
              >
                <div className="relative w-full aspect-square overflow-hidden bg-gray-100">
                  <img
                    src={p.mainImage ?? ""}
                    alt={p.title}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                </div>
                <div className="p-3 flex flex-col flex-1">
                  <div className="text-sm font-medium line-clamp-2 flex-1">
                    {p.title}
                  </div>
                  <div className="font-semibold mt-2 text-blue-600">
                    Rs {p.price}
                  </div>
                </div>
              </Link>
            ))}
          </div>

          {/* Load More */}
          {visibleCount < filteredProducts.length && (
            <div className="flex justify-center mt-8">
              <button
                onClick={() => setVisibleCount((prev) => prev + 20)}
                className="px-6 py-2 rounded-full bg-blue-600 text-white font-medium shadow hover:bg-blue-700 transition"
              >
                Load More
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
