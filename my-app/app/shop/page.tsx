// app/shop/page.tsx
// app/shop/page.tsx
"use client";

import React, { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import Catalog, { Category, Subcategory } from "@/app/lib/catalog";
import { categoryIcons, subcategoryIcons } from "@/app/lib/categoryIcons";
import { LucideIcon } from "lucide-react";

// Some gradient colors for subcategory badges
const subcategoryGradients = [
  "from-pink-400 to-pink-600",
  "from-indigo-400 to-indigo-600",
  "from-green-400 to-green-600",
  "from-orange-400 to-orange-600",
  "from-rose-400 to-rose-600",
  "from-cyan-400 to-blue-600",
  "from-purple-400 to-fuchsia-600",
  "from-yellow-400 to-orange-500",
];

export default function ShopPage() {
  const categories = Catalog.getCategories();
  const [activeCategory, setActiveCategory] = useState<Category>(categories[0]);

  return (
    <div className="flex h-screen bg-white overflow-hidden">
      {/* Left category column */}
      <div className="w-28 border-r border-gray-200 overflow-y-auto py-4 flex flex-col items-center gap-4">
        {categories.map((cat) => {
          const CatIcon = categoryIcons[cat.name]?.icon as LucideIcon;
          return (
            <motion.button
              key={cat.slug}
              onClick={() => setActiveCategory(cat)}
              whileTap={{ scale: 0.95 }}
              className={`flex flex-col items-center justify-center w-20 h-20 rounded-xl shadow-lg
                bg-white text-gray-800
                ${activeCategory.slug === cat.slug ? "ring-4 ring-offset-2 ring-indigo-500" : ""}`}
            >
              {CatIcon && <CatIcon className="w-8 h-8 mb-1 text-indigo-500" />}
              <span className="text-xs text-center">{cat.name}</span>
            </motion.button>
          );
        })}
      </div>

      {/* Right subcategories */}
      <div className="flex-1 overflow-y-auto p-6">
        <h2 className="text-2xl font-bold mb-6 text-center">{activeCategory.name}</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 justify-items-center">
          {activeCategory.subcategories.map((sub: Subcategory, index: number) => {
            const SubIcon = subcategoryIcons[sub.name] as LucideIcon;
            // Cycle through gradient colors
            const gradient = subcategoryGradients[index % subcategoryGradients.length];
            return (
              <Link
                key={sub.slug}
                href={`/shop/products/${encodeURIComponent(activeCategory.slug)}/${encodeURIComponent(sub.slug)}`}
                className={`flex flex-col items-center justify-center p-5 rounded-2xl shadow-lg hover:scale-105 transition-transform
                  bg-gradient-to-br ${gradient} text-white`}
              >
                {SubIcon && <SubIcon className="w-7 h-7 mb-3" />}
                <span className="text-sm font-semibold text-center">{sub.name}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
