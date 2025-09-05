// app/shop/[category]/[subcategory]/page.tsx
import Link from "next/link";
import Image from "next/image";
import Catalog, { Product } from "@/app/lib/catalog";

export default function SubcategoryPage({
  params,
}: {
  params: { category: string; subcategory: string };
}) {
  const { category, subcategory } = params;

  const products: Product[] = Catalog.getProducts(category, subcategory);

  if (products.length === 0) {
    return (
      <main className="p-4">
        <h1 className="text-xl font-bold mb-2">{subcategory}</h1>
        <div className="text-gray-500">
          No products found in this subcategory.
        </div>
      </main>
    );
  }

  return (
    <main className="p-4">
      <h1 className="text-2xl font-bold mb-4">{subcategory}</h1>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
        {products.map((p: Product) => (
          <Link
            key={p.id}
            href={`/shop/${category}/${subcategory}/${p.id}`}
            className="border rounded-lg p-2 shadow hover:shadow-lg transition block bg-white"
          >
            {p.img && (
              <div className="relative w-full h-40">
                <Image
                  src={p.img}
                  alt={p.title}
                  fill
                  className="object-cover rounded"
                  unoptimized
                />
              </div>
            )}
            <h2 className="text-sm font-medium mt-2 line-clamp-2">{p.title}</h2>
            <p className="text-red-600 font-bold mt-1">Rs {p.price}</p>
          </Link>
        ))}
      </div>
    </main>
  );
}

