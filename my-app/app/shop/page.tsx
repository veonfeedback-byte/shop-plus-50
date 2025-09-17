"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { motion, AnimatePresence, useMotionValue, useTransform } from "framer-motion";
import Catalog, { Category, Subcategory } from "@/app/lib/catalog";
import { categoryIcons, subcategoryIcons } from "@/app/lib/categoryIcons";
import { LucideIcon } from "lucide-react";

const subcategoryGradients = [
  "from-purple-500 to-indigo-600",
  "from-pink-500 to-rose-600",
  "from-teal-400 to-cyan-500",
  "from-orange-400 to-yellow-500",
  "from-green-400 to-lime-500",
  "from-blue-400 to-indigo-500",
];

export default function ShopPage() {
  const categories = Catalog.getCategories();
  const [activeCategory, setActiveCategory] = useState<Category>(categories[0]);
  const containerRef = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);

  const [underlineProps, setUnderlineProps] = useState<{ left: number; width: number }>({ left: 0, width: 0 });

  // Center active card with empty space for first/last
  const centerActive = () => {
    const el = containerRef.current;
    if (!el) return;
    const activeEl = el.querySelector<HTMLDivElement>(`[data-slug="${activeCategory.slug}"]`);
    if (activeEl) {
      setUnderlineProps({ left: activeEl.offsetLeft, width: activeEl.offsetWidth });

      const parentWidth = el.clientWidth;
      const cardWidth = activeEl.offsetWidth;
      let scrollX = activeEl.offsetLeft - parentWidth / 2 + cardWidth / 2;

      // Add empty space for first/last
      const maxScroll = el.scrollWidth - parentWidth;
      scrollX = Math.max(0, Math.min(maxScroll, scrollX));
      el.scrollTo({ left: scrollX, behavior: "smooth" });
    }
  };

  useEffect(() => {
    centerActive();
    window.addEventListener("resize", centerActive);
    return () => window.removeEventListener("resize", centerActive);
  }, [activeCategory]);

  // Snap to center on scroll
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    let timeout: NodeJS.Timeout;
    const handleScroll = () => {
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        const children = Array.from(el.children) as HTMLDivElement[];
        const parentRect = el.getBoundingClientRect();
        let closest: HTMLDivElement | null = null;
        let minDistance = Infinity;
        for (const child of children) {
          const rect = child.getBoundingClientRect();
          const distance = Math.abs(rect.left + rect.width / 2 - (parentRect.left + parentRect.width / 2));
          if (distance < minDistance) {
            minDistance = distance;
            closest = child;
          }
        }
        if (closest) {
          const slug = closest.getAttribute("data-slug");
          const newCategory = categories.find((c) => c.slug === slug);
          if (newCategory && newCategory.slug !== activeCategory.slug) {
            setActiveCategory(newCategory);
          }
        }
      }, 80);
    };
    el.addEventListener("scroll", handleScroll, { passive: true });
    return () => el.removeEventListener("scroll", handleScroll);
  }, [activeCategory, categories]);

  return (
    <div className="flex flex-col h-screen bg-gray-50 overflow-hidden">
      {/* Category Card Carousel */}
      <motion.div
        ref={containerRef}
        className="relative flex overflow-x-auto gap-4 px-0 py-4 no-scrollbar perspective-1000"
        style={{ x, paddingLeft: "50%", paddingRight: "50%" }} // Empty space for first/last
      >
        {categories.map((cat, index) => {
          const CatIcon = categoryIcons[cat.name]?.icon as LucideIcon | undefined;
          const isActive = cat.slug === activeCategory.slug;

          const rotateY = useTransform(x, [-500, 500], [25, -25]);

          return (
            <motion.div
              key={cat.slug}
              data-slug={cat.slug}
              className={`flex flex-col items-center justify-center min-w-[110px] px-5 py-4 rounded-lg cursor-pointer transition-all
                ${isActive
                  ? "bg-gradient-to-r from-purple-600 to-indigo-700 text-white shadow-xl scale-110"
                  : "bg-white text-gray-700 shadow hover:scale-105"}
              `}
              onClick={() => setActiveCategory(cat)}
              style={{ rotateY: isActive ? 0 : rotateY }}
              animate={{
                scale: isActive ? 1.1 : 1,
                opacity: isActive ? 1 : 0.8,
              }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
            >
              {CatIcon && <CatIcon className="w-8 h-8 mb-1" />}
              <span className="text-xs font-semibold text-center">{cat.name}</span>
            </motion.div>
          );
        })}

        {/* Active underline */}
        <AnimatePresence>
          <motion.div
            className="absolute bottom-0 h-1 rounded-full bg-indigo-400"
            animate={{ left: underlineProps.left, width: underlineProps.width }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
          />
        </AnimatePresence>
      </motion.div>

      {/* Subcategory Grid */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        <h2 className="text-2xl md:text-3xl font-bold mb-6 text-center text-gray-900">
          {activeCategory.name}
        </h2>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 md:gap-6">
          {activeCategory.subcategories.map((sub, index) => {
            const SubIcon = subcategoryIcons[sub.name] as LucideIcon | undefined;
            const gradient = subcategoryGradients[index % subcategoryGradients.length];

            return (
              <motion.div
                key={sub.slug}
                initial={{ opacity: 0, y: 20, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                whileHover={{ scale: 1.05, y: -2 }}
                transition={{ type: "spring", stiffness: 200, damping: 12, delay: index * 0.05 }}
              >
                <Link
                  href={`/shop/products/${encodeURIComponent(activeCategory.slug)}/${encodeURIComponent(sub.slug)}`}
                  className={`flex flex-col items-center justify-center p-4 md:p-6 rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-200
                    bg-gradient-to-br ${gradient} text-white`}
                >
                  {SubIcon && <SubIcon className="w-7 h-7 mb-2 md:mb-3" />}
                  <span className="text-sm md:text-base font-semibold text-center">{sub.name}</span>
                </Link>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
