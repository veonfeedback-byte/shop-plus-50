"use client";

import "./globals.css";
import BottomNav from "@/app/components/BottomNav";
import { ShoppingBag } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const [cartCount, setCartCount] = useState(0);

  // Function to recalculate total cart count
  const updateCartCount = () => {
    const cart = JSON.parse(localStorage.getItem("cart") || "[]");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const total = cart.reduce((sum: number, item: any) => sum + item.qty, 0);
    setCartCount(total);
  };

  useEffect(() => {
    // Initial load
    updateCartCount();

    // Listen for changes from other tabs
    const storageHandler = (e: StorageEvent) => {
      if (e.key === "cart") updateCartCount();
    };

    // Listen for same-tab cart updates (triggered from addToCart in ProductPage)
    const cartUpdatedHandler = () => updateCartCount();

    window.addEventListener("storage", storageHandler);
    window.addEventListener("cartUpdated", cartUpdatedHandler);

    return () => {
      window.removeEventListener("storage", storageHandler);
      window.removeEventListener("cartUpdated", cartUpdatedHandler);
    };
  }, []);

  return (
    <html lang="en">
      <head>
        <title>TROLLY</title>
        <link rel="icon" href="/assets/favicon.png" />
      </head>
      <body className="bg-gray-50">
        {/* Header */}
        <header className="border-b bg-white shadow-sm sticky top-0 z-50">
          <div className="max-w-5xl mx-auto flex items-center justify-between p-3">
            {/* Logo */}
            <div className="flex items-center gap-2">
              <Link href="/">
                <Image
                  src="/assets/Logo.png"
                  alt="Shop Logo"
                  width={120}
                  height={40}
                  style={{ width: "120px" , height: "40px"}}
                  priority
                />
              </Link>
            </div>

            {/* Cart Icon */}
            <Link href="/cart" className="relative">
              <ShoppingBag className="w-6 h-6 text-gray-700 hover:text-indigo-600 transition-colors" />
              <AnimatePresence>
                {cartCount > 0 && (
                  <motion.span
                    key={cartCount} // triggers animation when count changes
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    exit={{ scale: 0 }}
                    transition={{ type: "spring", stiffness: 400, damping: 20 }}
                    className="absolute -top-2 -right-2 bg-red-500 text-white text-xs w-5 h-5 flex items-center justify-center rounded-full"
                  >
                    {cartCount}
                  </motion.span>
                )}
              </AnimatePresence>
            </Link>
          </div>
        </header>

        {/* Main Content */}
        <main className="max-w-5xl mx-auto p-4">{children}</main>

        {/* Bottom Navigation */}
        <BottomNav />
      </body>
    </html>
  );
}
