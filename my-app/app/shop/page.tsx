// app/shop/page.tsx
"use client";

import Link from "next/link";
import Catalog, { Category } from "../lib/catalog";

const emojiMap: Record<string, string> = {
  "Men's Stitched": "👔",
  "Men's Unstitched": "🧵",
  "Women's Stitched": "👗",
  "Women's Unstitched": "🧵",
  Kitchenware: "🍳",
  Cosmetics: "💄",
  Jewellery: "💍",
  Bedding: "🛏️",
  Electronics: "🔌",
  "Kids Clothing": "🧒",
  Watches: "⌚",
  Perfumes: "🌸",
  Bags: "👜",
};

export default function ShopPage() {
  const categories: Category[] = Catalog.getCategories();

  return (
    <main className="p-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-6">
      {categories.map((cat: Category) => (
        <Link
          key={cat.slug}
          href={`/shop/${cat.slug}`}
          className="flex flex-col items-center space-y-2"
        >
          <div className="w-20 h-20 flex items-center justify-center rounded-full bg-gray-100 text-3xl shadow">
            {emojiMap[cat.name] || "🛍️"}
          </div>
          <span className="text-sm font-medium text-center">{cat.name}</span>
        </Link>
      ))}
    </main>
  );
}
