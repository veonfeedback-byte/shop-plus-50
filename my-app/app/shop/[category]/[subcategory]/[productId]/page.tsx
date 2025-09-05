// app/shop/[category]/[subcategory]/[productId]/page.tsx
"use client";

import Catalog, { Product } from "@/app/lib/catalog";
import { useRouter } from "next/navigation";
import { CartItem } from "@/app/lib/types";

export default function ProductPage({
  params,
}: {
  params: { category: string; subcategory: string; productId: string };
}) {
  const router = useRouter();
  const found = Catalog.getProduct(params.productId);

  if (!found) {
    return <div className="p-4">Not found</div>;
  }

  const product: Product = found;

  function addToCart(goCheckout = false) {
    const cart: CartItem[] = JSON.parse(localStorage.getItem("cart") || "[]");
    const i = cart.findIndex((x) => x.id === product.id);

    if (i >= 0) {
      cart[i].qty += 1;
    } else {
      cart.push({
        id: product.id,
        code: product.code,
        title: product.title,
        image: product.images?.[0] ?? "",
        price: Number(product.price),
        qty: 1,
      });
    }

    localStorage.setItem("cart", JSON.stringify(cart));
    router.push(goCheckout ? "/cart?checkout=1" : "/cart");
  }

  return (
    <div className="space-y-4 p-4">
      {product.images?.length ? (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {product.images.map((src: string, i: number) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={i}
              src={src}
              alt={`${product.title} ${i + 1}`}
              className="w-full rounded border"
            />
          ))}
        </div>
      ) : null}

      <h1 className="text-2xl font-semibold">{product.title}</h1>
      <div className="font-bold text-lg">Rs {product.price}</div>
      {product.code && (
        <div className="text-sm text-gray-500">Code: {product.code}</div>
      )}
      {product.description && (
        <div className="prose max-w-none text-sm text-gray-700">
          {product.description}
        </div>
      )}

      <div className="flex gap-2">
        <button
          className="px-4 py-2 rounded border"
          onClick={() => addToCart(false)}
        >
          Add to cart
        </button>
        <button
          className="px-4 py-2 rounded border"
          onClick={() => addToCart(true)}
        >
          Buy now
        </button>
      </div>
    </div>
  );
}

