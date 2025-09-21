// shop/page.tsx
"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Head from "next/head";
import Catalog, { Category } from "@/app/lib/catalog";
import { categoryIcons, subcategoryIcons } from "@/app/lib/categoryIcons";
import { LucideIcon } from "lucide-react";

export default function ShopPage() {
  const categories = Catalog.getCategories();
  const [activeCategory, setActiveCategory] = useState<Category>(categories[0]);
  const sidebarRef = useRef<HTMLDivElement | null>(null);
  const btnRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const ACTIVE_COLOR = "#07254d";

  // Save shop state
  function saveShopState(activeCatSlug?: string, activeSubSlug?: string) {
    if (typeof window === "undefined") return;
    const payload = {
      query: "",
      scrollY: window.scrollY,
      activeFilter: null,
      activeCategorySlug: activeCatSlug ?? activeCategory?.slug ?? undefined,
      activeSubcategorySlug: activeSubSlug ?? undefined,
    };
    try {
      sessionStorage.setItem("lastSearch", JSON.stringify(payload));
    } catch {}
  }

  // Restore category on mount
  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const raw = sessionStorage.getItem("lastSearch");
      if (raw) {
        const parsed = JSON.parse(raw) as {
          activeCategorySlug?: string;
          activeSubcategorySlug?: string;
        };

        if (parsed?.activeCategorySlug) {
          const found = categories.find((c) => c.slug === parsed.activeCategorySlug);
          if (found) {
            setActiveCategory(found);
            requestAnimationFrame(() => {
              const btn = btnRefs.current[found.slug];
              if (btn && sidebarRef.current) {
                btn.scrollIntoView({ block: "center", inline: "nearest", behavior: "auto" });
              }
            });
          }
        }
      }
    } catch {}
  }, [categories]);

  // Scroll into view + save state when active changes
  useEffect(() => {
    if (!activeCategory) return;
    const t = setTimeout(() => {
      const btn = btnRefs.current[activeCategory.slug];
      if (btn && sidebarRef.current) {
        btn.scrollIntoView({ block: "center", inline: "nearest", behavior: "smooth" });
      }
      saveShopState(activeCategory.slug, undefined);
    }, 50);
    return () => clearTimeout(t);
  }, [activeCategory]);

  return (
    <>
      {/* ✅ SEO Meta Tags */}
      <Head>
        <title>
          Shop Online – {activeCategory.name} | Trolly Pakistan
        </title>
        <meta
          name="description"
          content={`Buy ${activeCategory.name} online in Pakistan at Trolly. Discover a wide range of products with affordable prices and fast delivery.`}
        />
        <meta
          name="keywords"
          content={`Trolly, ${activeCategory.name}, buy ${activeCategory.name} online, online shopping Pakistan`}
        />
        <meta name="robots" content="index, follow" />
        <link rel="canonical" href={`https://trollypk.vercel.app/shop`} />

        {/* Open Graph */}
        <meta property="og:type" content="website" />
        <meta
          property="og:title"
          content={`Shop ${activeCategory.name} Online in Pakistan | Trolly`}
        />
        <meta
          property="og:description"
          content={`Find the best ${activeCategory.name} at affordable prices on Trolly. Shop now and get fast delivery across Pakistan.`}
        />
        <meta
          property="og:url"
          content={`https://trollypk.vercel.app/shop`}
        />
        <meta property="og:image" content="/assets/Logo.png" />

        {/* Schema.org Category Page */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "CollectionPage",
              name: `${activeCategory.name} – Trolly`,
              description: `Explore ${activeCategory.name} products on Trolly.pk. Shop online in Pakistan with best prices and delivery.`,
              url: `https://trollypk.vercel.app/shop`,
              isPartOf: {
                "@type": "WebSite",
                name: "Trolly",
                url: "https://trollypk.vercel.app",
              },
            }),
          }}
        />
      </Head>

      {/* ✅ Your Original Shop Page Layout */}
      <div className="flex h-screen bg-gray-50">
        {/* Left Sidebar Categories */}
        <aside
          ref={sidebarRef}
          className="w-28 sm:w-32 md:w-40 bg-white border-r shadow-sm overflow-y-auto no-scrollbar"
        >
          <div className="flex flex-col items-stretch py-4 gap-1">
            {categories.map((cat) => {
              const CatIcon = categoryIcons[cat.name]?.icon as LucideIcon | undefined;
              const isActive = activeCategory.slug === cat.slug;

              return (
                <button
                  key={cat.slug}
                  ref={(el) => {
                    btnRefs.current[cat.slug] = el;
                  }}
                  onClick={() => {
                    setActiveCategory(cat);
                    saveShopState(cat.slug, undefined);
                  }}
                  className={`flex flex-col items-center justify-center px-2 py-4 mx-2 rounded-lg transition-all duration-200 
                    ${
                      isActive
                        ? "border-l-4 bg-gray-50 shadow-sm"
                        : "hover:bg-gray-100"
                    }`}
                  style={isActive ? { borderLeftColor: ACTIVE_COLOR } : {}}
                >
                  {CatIcon && (
                    <CatIcon
                      className={`w-6 h-6 mb-1 ${
                        isActive ? "text-[#07254d]" : "text-gray-500"
                      }`}
                    />
                  )}
                  <span
                    className={`text-xs font-medium text-center ${
                      isActive ? "text-[#07254d]" : "text-gray-600"
                    }`}
                  >
                    {cat.name}
                  </span>
                </button>
              );
            })}
          </div>
        </aside>

        {/* Main Subcategory Grid */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          <h2 className="text-lg sm:text-xl font-bold mb-5 text-[#07254d] border-b pb-2">
            {activeCategory.name}
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 sm:gap-6">
            {activeCategory.subcategories.map((sub) => {
              const SubIcon = subcategoryIcons[sub.name] as LucideIcon | undefined;

              return (
                <Link
                  key={sub.slug}
                  href={`/shop/products/${encodeURIComponent(activeCategory.slug)}/${encodeURIComponent(
                    sub.slug
                  )}`}
                  onClick={() => {
                    saveShopState(activeCategory.slug, sub.slug);
                  }}
                  className="flex flex-col items-center justify-center h-28 w-full p-3 rounded-xl bg-white 
                    border border-gray-200 shadow-sm hover:border-[#07254d] hover:shadow-md transition-all duration-200"
                >
                  {SubIcon && <SubIcon className="w-7 h-7 mb-2 text-[#07254d]" />}
                  <span className="text-sm font-medium text-gray-800 text-center">{sub.name}</span>
                </Link>
              );
            })}
          </div>
        </main>
      </div>
    </>
  );
}
