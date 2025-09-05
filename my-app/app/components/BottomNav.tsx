// app/components/BottomNav.tsx
"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useHome } from "../lib/HomeContext";
import { motion } from "framer-motion";

const items = [
  { href: "/", label: "Home", emoji: "🏠" },
  { href: "/shop", label: "Shop", emoji: "🛍️" },
  { href: "/cart", label: "Cart", emoji: "🛒" },
  { href: "/profile", label: "Profile", emoji: "👤" },
];

export default function BottomNav() {
  const path = usePathname();
  const router = useRouter();
  const { resetHome } = useHome();

  return (
    <nav className="fixed bottom-0 left-0 right-0 border-t bg-white/95 backdrop-blur">
      <div className="grid grid-cols-4 max-w-5xl mx-auto text-sm">
        {items.map((it) => {
          const isActive = path === it.href;

          if (it.href === "/") {
            // Special behavior for Home
            return (
              <motion.button
                key={it.href}
                whileTap={{ scale: 0.85 }}
                transition={{ type: "spring", stiffness: 300, damping: 15 }}
                onClick={() => {
                  if (isActive) {
                    resetHome?.();
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  } else {
                    router.push("/");
                  }
                }}
                className={`flex flex-col items-center py-2 w-full ${
                  isActive ? "font-semibold" : "text-gray-600"
                }`}
              >
                <div className="text-xl">{it.emoji}</div>
                <div>{it.label}</div>
              </motion.button>
            );
          }

          // ✅ Other tabs: keep Link (prefetch) + bounce
          return (
            <Link key={it.href} href={it.href} prefetch>
              <motion.div
                whileTap={{ scale: 0.85 }}
                transition={{ type: "spring", stiffness: 300, damping: 15 }}
                className={`flex flex-col items-center py-2 ${
                  isActive ? "font-semibold" : "text-gray-600"
                }`}
              >
                <div className="text-xl">{it.emoji}</div>
                <div>{it.label}</div>
              </motion.div>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
