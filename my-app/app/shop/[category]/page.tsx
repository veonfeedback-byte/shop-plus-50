// app/shop/[category]/page.tsx
import Link from "next/link";
import Catalog, { Subcategory, Category } from "@/app/lib/catalog";

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ category: string }>;
}) {
  const { category } = await params; // 👈 await params

  const categoryObj: Category | undefined = Catalog.getCategoryBySlug(category);
  const subs: Subcategory[] = Catalog.getSubcategories(category);

  if (!categoryObj) {
    return <main className="p-4">Category not found</main>;
  }

  if (!subs.length) {
    return (
      <main className="p-4">
        <h1 className="text-2xl font-bold mb-2">{categoryObj.name}</h1>
        <div className="text-gray-500">No subcategories yet.</div>
      </main>
    );
  }

  return (
    <main className="p-4">
      <h1 className="text-2xl font-bold mb-4">{categoryObj.name}</h1>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
        {subs.map((s: Subcategory) => (
          <Link
            key={s.slug}
            href={`/shop/${categoryObj.slug}/${s.slug}`}
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
