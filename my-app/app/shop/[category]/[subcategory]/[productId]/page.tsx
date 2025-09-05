"use client";
import React, { use, useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Catalog, { Product } from "@/app/lib/catalog";
import { CartItem } from "@/app/lib/types";
import Image from "next/image";
import { motion } from "framer-motion";

export default function ProductPage({
  params,
}: {
  params: Promise<{ category: string; subcategory: string; productId: string }>;
}) {
  const router = useRouter();
  const { category, subcategory, productId } = use(params);

  const found = Catalog.getProduct(productId);
  if (!found) return <div className="p-4">Not found</div>;
  const product: Product = found;

  // State
  const [qty, setQty] = useState(1);
  const [note, setNote] = useState("");
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  const [imgIndex, setImgIndex] = useState(0);

  // Swipe refs
  const startX = useRef(0);
  const endX = useRef(0);

  // Sizes / colors from description
  const sizes =
    product.description?.match(/sizes?:\s*([a-z0-9, ]+)/i)?.[1]
      ?.split(",")
      .map((s) => s.trim()) || [];
  const colors =
    product.description?.match(/colors?:\s*([a-z0-9, ]+)/i)?.[1]
      ?.split(",")
      .map((c) => c.trim()) || [];

  // Auto-slide carousel
  useEffect(() => {
    if (!product.images?.length) return;
    const timer = setInterval(() => {
      setImgIndex((i) => (i + 1) % product.images!.length);
    }, 3000);
    return () => clearInterval(timer);
  }, [product.images]);

  // Swipe handling
  const handleTouchStart = (e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    endX.current = e.changedTouches[0].clientX;
    if (startX.current - endX.current > 50) {
      // swipe left
      setImgIndex((i) => (i + 1) % product.images!.length);
    } else if (endX.current - startX.current > 50) {
      // swipe right
      setImgIndex((i) =>
        i === 0 ? product.images!.length - 1 : i - 1
      );
    }
  };

  // Add to cart
  function addToCart(goCheckout = false) {
    const cart: CartItem[] = JSON.parse(localStorage.getItem("cart") || "[]");
    const i = cart.findIndex((x) => x.id === product.id);

    if (i >= 0) {
      cart[i].qty += qty;
      cart[i].note = note;
      cart[i].size = selectedSize || null;
      cart[i].color = selectedColor || null;
    } else {
      cart.push({
        id: product.id,
        code: product.code,
        title: product.title,
        image: product.images?.[0] ?? "",
        price: Number(product.price),
        qty,
        note,
        size: selectedSize || null,
        color: selectedColor || null,
      });
    }

    localStorage.setItem("cart", JSON.stringify(cart));
    router.push(goCheckout ? "/cart?checkout=1" : "/cart");
  }

  const blurData =
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8Xw8AAuMB9o7bF7sAAAAASUVORK5CYII=";

  return (
    <div className="space-y-6 p-4">
      {/* 🔹 Image carousel with swipe */}
      {product.images?.length ? (
        <div
          className="relative w-full aspect-square overflow-hidden rounded-lg bg-gray-100"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          <motion.div
            className="flex h-full"
            animate={{ x: `-${imgIndex * 100}%` }}
            transition={{ type: "spring", stiffness: 200, damping: 30 }}
            style={{ width: `${product.images.length * 100}%` }}
          >
            {product.images.map((src, i) => (
              <div key={i} className="w-full flex-shrink-0 relative">
                <Image
                  src={src}
                  alt={`${product.title} ${i + 1}`}
                  fill
                  className="object-cover"
                  unoptimized
                  priority={i === 0}
                  placeholder="blur"
                  blurDataURL={blurData}
                />
              </div>
            ))}
          </motion.div>

          {/* dots */}
          <div className="absolute bottom-2 w-full flex justify-center gap-2">
            {product.images.map((_, i) => (
              <button
                key={i}
                onClick={() => setImgIndex(i)}
                className={`w-2 h-2 rounded-full ${
                  imgIndex === i ? "bg-black" : "bg-gray-400"
                }`}
              />
            ))}
          </div>
        </div>
      ) : null}

      {/* Product details */}
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

      {/* Quantity */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => setQty((q) => Math.max(1, q - 1))}
          className="px-3 py-1 border rounded"
        >
          -
        </button>
        <span className="font-medium">{qty}</span>
        <button
          onClick={() => setQty((q) => q + 1)}
          className="px-3 py-1 border rounded"
        >
          +
        </button>
      </div>

      {/* Sizes */}
      {sizes.length > 0 && (
        <div>
          <h3 className="font-medium mb-2">Sizes</h3>
          <div className="flex flex-wrap gap-2">
            {sizes.map((s) => (
              <button
                key={s}
                onClick={() => setSelectedSize(s)}
                className={`px-3 py-1 rounded border ${
                  selectedSize === s
                    ? "bg-black text-white"
                    : "bg-white text-gray-700"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Colors */}
      {colors.length > 0 && (
        <div>
          <h3 className="font-medium mb-2">Colors</h3>
          <div className="flex flex-wrap gap-2">
            {colors.map((c) => (
              <button
                key={c}
                onClick={() => setSelectedColor(c)}
                className={`px-3 py-1 rounded border ${
                  selectedColor === c
                    ? "bg-black text-white"
                    : "bg-white text-gray-700"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Note */}
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Add extra details (optional)"
        className="w-full border rounded p-2"
        rows={3}
      />

      {/* Actions */}
      <div className="flex gap-2">
        <button
          className="flex-1 px-4 py-2 rounded border bg-gray-100"
          onClick={() => addToCart(false)}
        >
          Add to cart
        </button>
        <button
          className="flex-1 px-4 py-2 rounded border bg-black text-white"
          onClick={() => addToCart(true)}
        >
          Buy now
        </button>
      </div>

      {/* 🔹 Related products (3 horizontal scroll rows, 10 each) */}
      <div className="mt-8">
        <h2 className="text-lg font-bold mb-4">Related Products</h2>

        {[0, 1, 2].map((row) => (
          <div key={row} className="mb-6 overflow-x-auto scrollbar-hide">
            <div className="flex gap-4 w-max">
              {Catalog.getProducts(category, subcategory)
                .filter((p) => p.id !== product.id)
                .slice(row * 10, row * 10 + 10)
                .map((p) => (
                  <div
                    key={p.id}
                    onClick={() =>
                      router.push(`/shop/${category}/${subcategory}/${p.id}`)
                    }
                    className="w-40 flex-shrink-0 border rounded-lg shadow bg-white cursor-pointer hover:shadow-lg transition"
                  >
                    {p.img && (
                      <div className="relative w-full h-32">
                        <Image
                          src={p.img}
                          alt={p.title}
                          fill
                          className="object-cover rounded-t"
                          unoptimized
                          loading="lazy"
                          placeholder="blur"
                          blurDataURL={blurData}
                        />
                      </div>
                    )}
                    <div className="p-2">
                      <h3 className="text-xs font-medium line-clamp-2">
                        {p.title}
                      </h3>
                      <div className="text-sm font-bold text-red-600">
                        Rs {p.price}
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
