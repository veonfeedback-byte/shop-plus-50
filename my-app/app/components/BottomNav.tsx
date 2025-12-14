// app/components/BottomNav.tsx
"use client";

import { usePathname, useRouter } from "next/navigation";
import { useHome } from "../lib/HomeContext";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { MessageCircle } from "lucide-react"; // ✅ green WhatsApp-like icon

// ✅ icons from /public/assets
const items = [
  { href: "/", icon: "/assets/h.png", activeIcon: "/assets/hf.png", label: "Home" },
  { href: "/shop", icon: "/assets/s.png", activeIcon: "/assets/sf.png", label: "Shop" },
  { href: "/cart", icon: "/assets/c.png", activeIcon: "/assets/cf.png", label: "Cart" },
  { href: "/profile", icon: "/assets/p.png", activeIcon: "/assets/pf.png", label: "Profile" },
];

// 🔹 Elegant Circular Loader Overlay
function PageLoader({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/60 backdrop-blur-md z-40">
      <motion.div
        className="w-14 h-14 rounded-full border-4 border-blue-400 border-t-transparent"
        animate={{ rotate: 360 }}
        transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
      />
      <motion.p
        className="mt-3 text-gray-500 font-medium tracking-wide"
        animate={{ opacity: [0.4, 1, 0.4] }}
        transition={{ duration: 1.2, repeat: Infinity }}
      >
        Loading...
      </motion.p>
    </div>
  );
}

export default function BottomNav() {
  const path = usePathname();
  const router = useRouter();
  const { resetHome } = useHome();
  const [loading, setLoading] = useState(false);

  // ✅ WhatsApp popup state
  const [showWhatsApp, setShowWhatsApp] = useState(false);

  // ⚡ Preload all routes once for instant switching
  useEffect(() => {
    items.forEach((it) => {
      if (it.href !== path) {
        router.prefetch(it.href);
      }
    });
  }, [path, router]);

  useEffect(() => {
    setLoading(false);
  }, [path]);

  return (
    <>
      <PageLoader show={loading} />

      {/* ✅ WhatsApp Floating Button */}
      <div className="fixed bottom-30 right-5 z-50 flex flex-col items-end">
        {showWhatsApp && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="mb-3 w-56 bg-white rounded-xl shadow-lg border p-4"
          >
            <div className="text-sm text-gray-700 mb-3">
              <p>💬 Contact us on WhatsApp!</p>
              <p>we are available 24/7 for your support Just click the button below and get in touch with us.</p>

            </div>
            <a
              href="https://wa.me/923036789310"
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full text-center bg-green-500 text-white py-2 rounded-lg shadow hover:bg-green-600 transition"
            >
              Get in touch
            </a>

            <br/>

            <a
                href="/privacy-policy"
                className="block w-full text-center text-xs text-gray-500 underline hover:text-gray-700"
              >
                Privacy Policy
            </a>

          </motion.div>
        )}

        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={() => setShowWhatsApp((s) => !s)}
          className="w-14 h-14 rounded-full bg-green-500 text-white shadow-lg flex items-center justify-center hover:bg-green-600 transition"
        >
          <MessageCircle className="w-7 h-7" />
        </motion.button>
      </div>

      {/* ✅ Bottom Navigation */}
      <nav className="fixed bottom-4 left-1/2 -translate-x-1/2 w-[92%] max-w-md z-40">
        <div className="bg-white/80 backdrop-blur-xl shadow-lg rounded-2xl border border-white/30">
          <div className="grid grid-cols-4 text-center">
            {items.map((it) => {
              const isActive = path === it.href;
              const icon = isActive ? it.activeIcon : it.icon;

              return (
                <motion.button
                  key={it.href}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => {
                    if (it.href === "/") {
                      if (isActive) {
                        resetHome?.();
                        window.scrollTo({ top: 0, behavior: "smooth" });
                      } else {
                        setLoading(true);
                        router.push("/");
                      }
                    } else {
                      setLoading(true);
                      router.push(it.href);
                    }
                  }}
                  className="flex items-center justify-center py-3 w-full"
                >
                  <motion.img
                    src={icon}
                    alt={it.label}
                    className="w-7 h-7"
                    loading="eager"
                    decoding="async"
                    fetchPriority="high"
                    animate={isActive ? { scale: 1.2 } : { scale: 1 }}
                    transition={{ type: "spring", stiffness: 300, damping: 20 }}
                  />
                </motion.button>
              );
            })}
          </div>
        </div>
      </nav>
    </>
  );
}
