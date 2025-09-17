//shop/products/[category]/[subcategory]/page.tsx

"use client";

import React, { useMemo, useState } from "react";
import { use } from "react"; // <-- Important
import { useRouter } from "next/navigation";
import Link from "next/link";
import Catalog, { Product, Subcategory } from "@/app/lib/catalog";
import { ArrowLeft } from "lucide-react";
import Image from "next/image";

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

export default function SubcategoryPage(props: Props) {
  // unwrap params
  const { category: categorySlug, subcategory: subcategorySlug } = use(props.params);

  const router = useRouter();

  const category = Catalog.getCategories().find((c) => c.slug === categorySlug);
  const subcategory = category?.subcategories.find((s) => s.slug === subcategorySlug);

  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"asc" | "desc" | null>(null);

  const allProducts: IndexedProduct[] = useMemo(() => {
    if (!subcategory) return [];
    return (subcategory.products || [])
      .map((p) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const mainImage = p.img ?? (Array.isArray((p as any).images) ? (p as any).images[0] : null);
        const priceNum = p.price ? Number(p.price) : 0;
        if (!mainImage || !priceNum) return null;
        return { ...p, mainImage, price: String(priceNum) };
      })
      .filter(Boolean) as IndexedProduct[];
  }, [subcategory]);

  const filteredProducts = useMemo(() => {
    let filtered = allProducts;
    if (searchQuery.trim().length > 0) {
      filtered = filtered.filter((p) =>
        p.title.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    if (sortBy === "asc") filtered = filtered.sort((a, b) => Number(a.price) - Number(b.price));
    else if (sortBy === "desc") filtered = filtered.sort((a, b) => Number(b.price) - Number(a.price));
    return filtered;
  }, [allProducts, searchQuery, sortBy]);

  if (!category || !subcategory) return <div className="p-6">Subcategory not found.</div>;

  return (
    <div className="p-6">
      {/* Back + Subcategory Name */}
      <div className="flex items-center justify-center relative mb-6">
        <button
          onClick={() => router.back()}
          className="absolute left-0 p-2 rounded-full hover:bg-gray-200 transition"
        >
          <ArrowLeft size={24} className="text-black" />
        </button>
        <h1 className="text-3xl font-bold text-center">{subcategory.name}</h1>
      </div>

      {/* Search + Sort + Total Products */}
      <div className="flex flex-col md:flex-row items-center justify-between mb-6 gap-3">
        <input
          type="text"
          placeholder="Search in this subcategory..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="flex-1 rounded-xl border p-3 shadow focus:outline-none"
        />

        <div className="flex items-center gap-3">
          <span className="text-sm font-medium">{filteredProducts.length} products</span>
          <button
            className={`px-3 py-1 rounded ${sortBy === "asc" ? "bg-blue-600 text-white" : "bg-gray-200"}`}
            onClick={() => setSortBy("asc")}
          >
            Price ↑
          </button>
          <button
            className={`px-3 py-1 rounded ${sortBy === "desc" ? "bg-blue-600 text-white" : "bg-gray-200"}`}
            onClick={() => setSortBy("desc")}
          >
            Price ↓
          </button>
        </div>
      </div>

      {/* Products Grid */}
      {filteredProducts.length === 0 ? (
        <div className="text-center text-gray-500 mt-10">No products found.</div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {filteredProducts.map((p) => (
            <Link
              key={p.id}
              href={`/shop/${encodeURIComponent(category.slug)}/${encodeURIComponent(subcategory.slug)}/${encodeURIComponent(p.id)}`}
              className="flex flex-col items-center bg-white rounded-xl shadow hover:scale-[1.02] transition-transform p-3"
            >
              <div className="relative w-full aspect-square overflow-hidden rounded-lg bg-gray-100 mb-2">
                <Image
                  src={p.mainImage ?? ""}
                  alt={p.title}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              </div>
              <div className="text-sm font-medium text-center line-clamp-2">{p.title}</div>
              <div className="font-semibold mt-1">Rs {p.price}</div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
