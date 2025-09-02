// app/shop/[category]/page.tsx
"use client";

import Link from "next/link";
import Catalog, { Subcategory, Category } from "@/app/lib/catalog";

export default function CategoryPage({
  params,
}: {
  params: { category: string };
}) {
  const category: Category | undefined = Catalog.getCategoryBySlug(params.category);
  const subs: Subcategory[] = Catalog.getSubcategories(params.category);

  if (!category) {
    return <main className="p-4">Category not found</main>;
  }

  if (!subs.length) {
    return (
      <main className="p-4">
        <h1 className="text-2xl font-bold mb-2">{category.name}</h1>
        <div className="text-gray-500">No subcategories yet.</div>
      </main>
    );
  }

  return (
    <main className="p-4">
      <h1 className="text-2xl font-bold mb-4">{category.name}</h1>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
        {subs.map((s: Subcategory) => (
          <Link
            key={s.name}
            href={`/shop/${encodeURIComponent(category.name)}/${encodeURIComponent(s.name)}`}
            className="border rounded-lg p-4 shadow bg-white hover:shadow-lg transition text-center"
          >
            <div className="text-2xl">📦</div>
            <div className="text-sm font-medium mt-2">{s.name}</div>
          </Link>
        ))}
      </div>
    </main>
  );
}
