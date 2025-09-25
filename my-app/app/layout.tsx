"use client";

import "./globals.css";
import BottomNav from "@/app/components/BottomNav";
import { ShoppingBag, Download } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const [cartCount, setCartCount] = useState(0);
  const [showDownloadBox, setShowDownloadBox] = useState(false);
  const [downloaded, setDownloaded] = useState(false);
  const downloadBoxRef = useRef<HTMLDivElement>(null);

  // Function to recalculate total cart count
  const updateCartCount = () => {
    const cart = JSON.parse(localStorage.getItem("cart") || "[]");
    const total = cart.reduce((sum: number, item: any) => sum + item.qty, 0);
    setCartCount(total);
  };

  useEffect(() => {
    updateCartCount();

    const storageHandler = (e: StorageEvent) => {
      if (e.key === "cart") updateCartCount();
    };

    const cartUpdatedHandler = () => updateCartCount();

    window.addEventListener("storage", storageHandler);
    window.addEventListener("cartUpdated", cartUpdatedHandler);

    // Close download box if clicked outside
    const clickOutside = (e: MouseEvent) => {
      if (
        downloadBoxRef.current &&
        !downloadBoxRef.current.contains(e.target as Node)
      ) {
        setShowDownloadBox(false);
      }
    };
    document.addEventListener("mousedown", clickOutside);

    return () => {
      window.removeEventListener("storage", storageHandler);
      window.removeEventListener("cartUpdated", cartUpdatedHandler);
      document.removeEventListener("mousedown", clickOutside);
    };
  }, []);

  // Trigger download
  const handleDownload = () => {
    const link = document.createElement("a");
    link.href =
      "https://trollypk.vercel.app/downloads/trolly-pk-shop.apk";
    link.download = "Trolly.apk";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setDownloaded(true);
  };

  return (
    <html lang="en">
      <head>
        <title>TROLLY</title>
        <link rel="icon" href="/assets/favicon.png" />
      </head>
      <body className="bg-gray-50">
        {/* Header */}
        <header className="border-b bg-white shadow-sm sticky top-0 z-50">
          <div className="max-w-5xl mx-auto flex items-center justify-between p-3 relative">
            {/* Logo */}
            <div className="flex items-center gap-2">
              <Link href="/">
                <Image
                  src="/assets/Logo.png"
                  alt="Shop Logo"
                  width={90}
                  height={30}
                  style={{ width: "90px", height: "30px" }}
                  priority
                />
              </Link>
            </div>

            {/* Right Icons */}
            <div className="flex items-center gap-4 relative">
              {/* Download Icon */}
              <div className="relative">
                <button
                  onClick={() => setShowDownloadBox(!showDownloadBox)}
                  className="w-8 h-8 rounded-full bg-red-500 flex items-center justify-center text-white hover:bg-red-600 transition-colors"
                >
                  <Download className="w-4 h-4" />
                </button>

                {/* Slide-down Download Popup */}
                <AnimatePresence>
                  {showDownloadBox && (
                    <motion.div
                      ref={downloadBoxRef}
                      initial={{ opacity: 0, y: -20 }}
                      animate={{ opacity: 1, y: 10 }}
                      exit={{ opacity: 0, y: -20 }}
                      transition={{ type: "spring", stiffness: 300, damping: 25 }}
                      className="absolute right-0 top-full mt-2 w-64 bg-white border shadow-lg rounded-md p-3 z-50"
                    >
                      <p className="text-sm font-medium mb-2">
                        Download Trolly App now!
                      </p>
                      <button
                        onClick={handleDownload}
                        className={`w-full py-2 px-3 rounded-md text-white ${
                          downloaded
                            ? "bg-green-500 cursor-default"
                            : "bg-blue-600 hover:bg-blue-700"
                        } transition-colors`}
                        disabled={downloaded}
                      >
                        {downloaded ? "Downloaded" : "Download APK"}
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Cart Icon */}
              <Link href="/cart" className="relative">
                <ShoppingBag className="w-6 h-6 text-gray-700 hover:text-indigo-600 transition-colors" />
                <AnimatePresence>
                  {cartCount > 0 && (
                    <motion.span
                      key={cartCount}
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
