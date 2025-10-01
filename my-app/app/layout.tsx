"use client";

import "./globals.css";
import BottomNav from "@/app/components/BottomNav";
import { ShoppingBag, Download, Share2 } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const [cartCount, setCartCount] = useState(0);
  const [showDownloadBox, setShowDownloadBox] = useState(false);
  const [downloaded, setDownloaded] = useState(false);
  const downloadBoxRef = useRef<HTMLDivElement>(null);

  // URL to share
  const appLink = "https://trollypk.vercel.app/downloads/trolly-pk-shop.apk";

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

    // Detect if user already downloaded the APK previously
    const downloadedFlag = localStorage.getItem("trollyDownloaded");
    if (downloadedFlag === "true") setDownloaded(true);

    return () => {
      window.removeEventListener("storage", storageHandler);
      window.removeEventListener("cartUpdated", cartUpdatedHandler);
      document.removeEventListener("mousedown", clickOutside);
    };
  }, []);


    // Register Service Worker (PWA)
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js")
        .then(() => {
          console.log("✅ Service worker registered");
        })
        .catch(err => {
          console.error("❌ Service worker registration failed:", err);
        });
    }
  }, []);

  // Trigger download
  const handleDownload = () => {
    const link = document.createElement("a");
    link.href = appLink;
    link.download = "Trolly.apk";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setDownloaded(true);
    localStorage.setItem("trollyDownloaded", "true"); // persist
  };

  // Trigger native share
  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Trolly App",
          text: "Check out the Trolly App!",
          url: appLink,
        });
      } catch (err) {
        console.log("Share canceled or failed", err);
      }
    } else {
      // Fallback: copy link to clipboard
      navigator.clipboard.writeText(appLink);
      alert("Link copied to clipboard!");
    }
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
                        {downloaded
                          ? "You already have Trolly App!"
                          : "Download Trolly App now!"}
                      </p>

                      {/* Download Button */}
                      <button
                        onClick={handleDownload}
                        className={`w-full py-2 px-3 rounded-md text-white mb-2 ${
                          downloaded
                            ? "bg-green-500 cursor-default"
                            : "bg-blue-600 hover:bg-blue-700"
                        } transition-colors`}
                        disabled={downloaded}
                      >
                        {downloaded ? "Downloaded" : "Download APK"}
                      </button>

                      {/* Share Button */}
                      <button
                        onClick={handleShare}
                        className="w-full py-2 px-3 rounded-md text-white bg-indigo-600 hover:bg-indigo-700 transition-colors flex items-center justify-center gap-1"
                      >
                        <Share2 className="w-4 h-4" />
                        Share App
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
