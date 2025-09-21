"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Product } from "@/app/lib/catalog";
import { CartItem } from "@/app/lib/types";
import Image from "next/image";
import { motion } from "framer-motion";
import { supabase } from "@/app/lib/supabase";
import Catalog from "@/app/lib/catalog";


export default function ProductClient({
  product,
  params,
}: {
  product: Product;
  params: { category: string; subcategory: string; productId: string };
}) {
  const router = useRouter();
  const { category, subcategory } = params;

  const [qty, setQty] = useState(1);
  const [note, setNote] = useState("");
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  const [imgIndex, setImgIndex] = useState(0);

  const [couponCode, setCouponCode] = useState("");
  const [couponLoading, setCouponLoading] = useState(false);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [appliedCoupon, setAppliedCoupon] = useState<{
    code: string;
    discount_pct: number;
    active: boolean;
    id?: number | string;
  } | null>(null);

  const startX = useRef(0);

  const sizes =
    product.description?.match(/sizes?:\s*([a-z0-9, ]+)/i)?.[1]
      ?.split(",")
      .map((s) => s.trim()) || [];

  const colors =
    product.description?.match(/colors?:\s*([a-z0-9, ]+)/i)?.[1]
      ?.split(",")
      .map((c) => c.trim()) || [];

  useEffect(() => {
    if (!product.images?.length) return;
    const timer = setInterval(() => {
      setImgIndex((i) => (i + 1) % product.images!.length);
    }, 3000);
    return () => clearInterval(timer);
  }, [product.images]);

  const handleTouchStart = (e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const endX = e.changedTouches[0].clientX;
    if (startX.current - endX > 50) {
      setImgIndex((i) => (i + 1) % product.images!.length);
    } else if (endX - startX.current > 50) {
      setImgIndex((i) => (i === 0 ? product.images!.length - 1 : i - 1));
    }
  };

  const blurData =
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8Xw8AAuMB9o7bF7sAAAAASUVORK5CYII=";

  async function applyCoupon() {
    setCouponLoading(true);
    setCouponError(null);
    const code = (couponCode || "").trim().toUpperCase();
    if (!code) {
      setCouponError("Enter a coupon code");
      setCouponLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from("coupons")
        .select("id, code, discount_pct, active")
        .eq("code", code)
        .limit(1)
        .maybeSingle();

      if (error || !data) {
        setCouponError("Invalid coupon code");
        setAppliedCoupon(null);
      } else if (!data.active) {
        setCouponError("Coupon is not active");
        setAppliedCoupon(null);
      } else {
        const pct = Number(data.discount_pct) || 0;
        if (pct <= 0) {
          setCouponError("Coupon has invalid discount");
          setAppliedCoupon(null);
        } else {
          setAppliedCoupon({
            id: (data as any).id,
            code: (data as any).code,
            discount_pct: pct,
            active: true,
          });
        }
      }
    } catch (err) {
      console.error("coupon error", err);
      setCouponError("Unable to validate coupon");
      setAppliedCoupon(null);
    } finally {
      setCouponLoading(false);
    }
  }

  function removeCoupon() {
    setAppliedCoupon(null);
    setCouponCode("");
    setCouponError(null);
  }

  function computeFinalPricePerUnit(): number {
    const base = Number(product.price) || 0;
    if (appliedCoupon?.discount_pct) {
      return +(base * (1 - appliedCoupon.discount_pct / 100));
    }
    return base;
  }

  async function addToCart(goCheckout = false) {
    const cart: CartItem[] = JSON.parse(localStorage.getItem("cart") || "[]");
    const i = cart.findIndex((x) => x.id === product.id);

    const unitPrice = computeFinalPricePerUnit();
    const discount_amount_per_unit = (Number(product.price) || 0) - unitPrice;

    const item: CartItem = {
      id: product.id,
      code: product.code,
      title: product.title,
      image: product.images?.[0] ?? "",
      price: unitPrice,
      qty,
      note,
      size: selectedSize || null,
      color: selectedColor || null,
      meta: {
        original_price: Number(product.price) || 0,
        coupon: appliedCoupon ? appliedCoupon.code : null,
        discount_pct: appliedCoupon ? appliedCoupon.discount_pct : 0,
        discount_amount_per_unit,
      },
    };

    if (i >= 0) {
      cart[i] = { ...cart[i], ...item, qty: cart[i].qty + qty };
    } else {
      cart.push(item);
    }

    localStorage.setItem("cart", JSON.stringify(cart));
    window.dispatchEvent(new Event("cartUpdated"));

    router.push(goCheckout ? "/cart?checkout=1" : "/cart");
  }

  const basePrice = Number(product.price) || 0;
  const discounted = computeFinalPricePerUnit();

  return (
    <div className="space-y-6 p-4">
      {product.images?.length && (
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
      )}

      <h1 className="text-2xl font-semibold">{product.title}</h1>

      <div className="flex items-baseline gap-3">
        {appliedCoupon ? (
          <>
            <div className="text-lg font-semibold text-gray-400 line-through">
              Rs {basePrice.toFixed(2)}
            </div>
            <div className="text-2xl font-bold text-black">
              Rs {discounted.toFixed(2)}
            </div>
            <div className="text-sm text-green-600 font-medium">
              Save Rs {(basePrice - discounted).toFixed(2)} (
              {appliedCoupon.discount_pct}%)
            </div>
          </>
        ) : (
          <div className="font-bold text-lg">Rs {basePrice.toFixed(2)}</div>
        )}
      </div>

      {product.description && (
        <div className="prose max-w-none text-sm text-gray-700">
          {product.description}
        </div>
      )}

      {/* Coupon */}
      <div className="flex gap-2 items-center mt-2">
        <input
          type="text"
          value={couponCode}
          onChange={(e) => setCouponCode(e.target.value)}
          placeholder="Enter coupon code"
          className="flex-1 border rounded px-3 py-2"
          disabled={couponLoading}
        />
        {appliedCoupon ? (
          <div className="flex flex-col items-start gap-1 mt-1">
            <div className="text-sm font-medium text-green-700">
              Applied: {appliedCoupon.code} ({appliedCoupon.discount_pct}%)
            </div>
            <button
              onClick={removeCoupon}
              className="px-3 py-1 rounded border mt-1 bg-red-600 text-white font-semibold"
            >
              Remove
            </button>
          </div>
        ) : (
          <button
            onClick={applyCoupon}
            disabled={couponLoading}
            className="px-4 py-2 rounded bg-black text-white"
          >
            {couponLoading ? "Checking..." : "Apply"}
          </button>
        )}
      </div>
      {couponError && <div className="text-sm text-red-600 mt-1">{couponError}</div>}

      {/* Qty */}
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

      {/* Buttons */}
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

      {/* Related */}
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
