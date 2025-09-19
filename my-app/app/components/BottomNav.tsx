// app/components/BottomNav.tsx
"use client";

import { usePathname, useRouter } from "next/navigation";
import { useHome } from "../lib/HomeContext";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";

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
      {/* Animated Circle */}
      <motion.div
        className="w-14 h-14 rounded-full border-4 border-blue-400 border-t-transparent"
        animate={{ rotate: 360 }}
        transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
      />
      {/* Subtle text with animated dots */}
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

  // ⚡ Preload all routes once for instant switching
  useEffect(() => {
    items.forEach((it) => {
      if (it.href !== path) {
        router.prefetch(it.href);
      }
    });
  }, [path, router]);

  // Turn off loader when path changes
  useEffect(() => {
    setLoading(false);
  }, [path]);

  return (
    <>
      {/* 🔹 Loader overlays content but not BottomNav */}
      <PageLoader show={loading} />

      <nav className="fixed bottom-4 left-1/2 -translate-x-1/2 w-[92%] max-w-md z-50">
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
                      router.push(it.href); // ⚡ faster than <Link>
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
