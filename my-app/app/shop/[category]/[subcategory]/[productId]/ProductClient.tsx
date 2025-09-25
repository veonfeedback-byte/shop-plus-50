"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Product } from "@/app/lib/catalog";
import { CartItem } from "@/app/lib/types";
import Image from "next/image";
import { motion } from "framer-motion";
import { supabase } from "@/app/lib/supabase";
import Catalog from "@/app/lib/catalog";
import { Trash2, X as LucidX } from "lucide-react";
import Confetti from "react-confetti";

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
  const [showConfetti, setShowConfetti] = useState(false);

  const [fullImage, setFullImage] = useState<string | null>(null);


  const [appliedCoupon, setAppliedCoupon] = useState<{
    code: string;
    discount_pct: number;
    active: boolean;
    id?: number | string;
  } | null>(null);

  const startX = useRef(0);
  const [addedAnim, setAddedAnim] = useState(false);

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

  // 🚨 Block if product < 600
  if ((Number(product.price) || 0) < 600) {
    setCouponError("Coupon only applies to products priced at Rs 600 or more");
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
        setShowConfetti(true);
        setTimeout(() => setShowConfetti(false), 4000); // stop after 4 sec

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

  function computeDeliveryCharge(subtotal: number): number {
  return subtotal < 600 ? 100 : 0;
}

async function addToCart(goCheckout = false) {
  const cart: CartItem[] = JSON.parse(localStorage.getItem("cart") || "[]");
  const i = cart.findIndex((x) => x.id === product.id);

  const unitPrice = computeFinalPricePerUnit();
  const discount_amount_per_unit = (Number(product.price) || 0) - unitPrice;

  const subtotal = unitPrice * qty;
  const delivery = computeDeliveryCharge(subtotal);

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

    // ✅ Add these two
    category,
    subcategory,

    meta: {
      original_price: Number(product.price) || 0,
      coupon: appliedCoupon ? appliedCoupon.code : null,
      discount_pct: appliedCoupon ? appliedCoupon.discount_pct : 0,
      discount_amount_per_unit,
      delivery_charge: delivery,
      subtotal,
      total_with_delivery: subtotal + delivery,
    },
  };

  if (i >= 0) {
    cart[i] = { ...cart[i], ...item, qty: cart[i].qty + qty };
  } else {
    cart.push(item);
  }

  localStorage.setItem("cart", JSON.stringify(cart));
  window.dispatchEvent(new Event("cartUpdated"));

  if (goCheckout) {
    router.push("/cart?checkout=1");
  } else {
    setAddedAnim(true);
    setTimeout(() => setAddedAnim(false), 800);
  }
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
              <div key={i} className="w-full flex-shrink-0 relative aspect-auto cursor-pointer">
                <Image
                  src={src}
                  alt={`${product.title} ${i + 1}`}
                  fill
                  className="object-contain"
                  unoptimized
                  priority={i === 0}
                  placeholder="blur"
                  blurDataURL={blurData}
                  onClick={() => setFullImage(src)}
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
            
      <div className="text-lg text-gray-700">
        Delivery Charges:{" "}
        {computeDeliveryCharge(discounted * qty) > 0 ? (
          <span className="font-bold text-lg">Rs 100</span>
        ) : (
          <span className="font-bold text-lg text-green-600">Free</span>
        )}
      </div>

      {/* Description */}
      {product.description && (
        <div className="text-sm text-gray-700 space-y-1">
          <h3 className="text-base font-semibold mb-2">Product Description</h3>
          <div className="space-y-1">
            {product.description
              .split("\n") // split by new lines
              .map((line) => line.trim())
              .filter(
                (line) =>
                  line.length > 0 &&
                  !/^product\s*code\s*:/i.test(line) && // 🚫 hide "Product Code:"
                  !/^MZ\d+/i.test(line) // 🚫 hide codes like MZ1176200122...
              )
              .map((line, i) => {
                const [label, ...rest] = line.split(":");
                const value = rest.join(":").trim();
                return (
                  <div key={i}>
                    {label && (
                      <span className="font-semibold">{label.trim()}</span>
                    )}
                    {value && (
                      <span className="ml-1">{value}</span>
                    )}
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* Coupon */}
      <div className="mt-2">
        {appliedCoupon ? (
          <div className="flex items-center justify-between bg-red-50 border border-red-200 rounded-lg px-4 py-2 shadow-sm">
            <div className="flex flex-col">
              <span className="font-bold text-red-700">
                🎟 {appliedCoupon.code}
              </span>
              <span className="text-sm text-gray-600">
                {appliedCoupon.discount_pct}% OFF applied
              </span>
            </div>
            <button
              onClick={removeCoupon}
              className="p-2 text-red-600 hover:text-red-800"
            >
              <Trash2 size={20} />
            </button>
          </div>
        ) : (
          <div className="flex gap-2 items-center">
            <input
              type="text"
              value={couponCode}
              onChange={(e) => setCouponCode(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && applyCoupon()}
              placeholder="Enter coupon code"
              className="flex-1 border rounded px-3 py-2"
              disabled={couponLoading}
            />
            <button
              onClick={applyCoupon}
              disabled={couponLoading}
              className="px-4 py-2 rounded bg-black text-white"
            >
              {couponLoading ? "Checking..." : "Apply"}
            </button>
          </div>
        )}
        {couponError && <div className="text-sm text-red-600 mt-1">{couponError}</div>}
      </div>

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
              .filter(
                (p) =>
                  p.id !== product.id &&             // not the current product
                  Number(p.price) > 0 &&             // 🚫 skip products with price 0
                  p.img && p.img.trim() !== ""       // 🚫 skip products without image
              )
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
      
      {/* Floating +1 animation when added */}
      {addedAnim && (
        <motion.div
          initial={{ opacity: 0, y: 0, scale: 0.5 }}
          animate={{ opacity: 1, y: -40, scale: 1 }}
          exit={{ opacity: 0, y: -80, scale: 0 }}
          transition={{ duration: 0.6 }}
          className="fixed top-4 right-6 bg-red-600 text-white rounded-full w-8 h-8 flex items-center justify-center shadow-lg z-50"
        >
          +{qty}
        </motion.div>
)}

{showConfetti && (
  <Confetti
    recycle={false}
    numberOfPieces={200}
    gravity={0.3}
    tweenDuration={2000}
  />
)}


      {fullImage && (
        <div className="fixed inset-0 z-50 bg-black bg-opacity-90 flex items-center justify-center p-4">
          <button
            onClick={() => setFullImage(null)}
            className="absolute top-4 right-4 text-white p-2 rounded-full hover:bg-gray-800"
          >
            <LucidX size={32} />
          </button>
          <Image
            src={fullImage}
            alt="Full view"
            width={800}
            height={800}
            className="object-contain max-h-full max-w-full"
            unoptimized
          />
        </div>
      )}

    </div>
  );
}
