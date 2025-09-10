// app/components/BottomNav.tsx
"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useHome } from "../lib/HomeContext";
import { motion } from "framer-motion";

// ✅ icons from /public/assets
const items = [
  { href: "/", icon: "/assets/h.png", activeIcon: "/assets/hf.png" },
  { href: "/shop", icon: "/assets/s.png", activeIcon: "/assets/sf.png" },
  { href: "/cart", icon: "/assets/c.png", activeIcon: "/assets/cf.png" },
  { href: "/profile", icon: "/assets/p.png", activeIcon: "/assets/pf.png" },
];

export default function BottomNav() {
  const path = usePathname();
  const router = useRouter();
  const { resetHome } = useHome();

  return (
    <nav className="fixed bottom-4 left-1/2 -translate-x-1/2 w-[92%] max-w-md z-50">
      <div className="bg-white/70 backdrop-blur-xl shadow-lg rounded-2xl border border-white/30">
        <div className="grid grid-cols-4 text-center">
          {items.map((it) => {
            const isActive = path === it.href;
            const icon = isActive ? it.activeIcon : it.icon;

            if (it.href === "/") {
              // 🏠 Special: reset home on re-click
              return (
                <motion.button
                  key={it.href}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => {
                    if (isActive) {
                      resetHome?.();
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    } else {
                      router.push("/"); // ⚡ instant navigation
                    }
                  }}
                  className="flex items-center justify-center py-3"
                >
                  <motion.img
                    src={icon}
                    alt="Home"
                    className="w-7 h-7"
                    animate={isActive ? { scale: 1.2 } : { scale: 1 }}
                    transition={{ type: "spring", stiffness: 300, damping: 20 }}
                  />
                </motion.button>
              );
            }

            return (
              <motion.div key={it.href} whileTap={{ scale: 0.9 }}>
                <Link href={it.href} prefetch={false} className="flex items-center justify-center py-3">
                  <motion.img
                    src={icon}
                    alt={it.href}
                    className="w-7 h-7"
                    animate={isActive ? { scale: 1.2 } : { scale: 1 }}
                    transition={{ type: "spring", stiffness: 300, damping: 20 }}
                  />
                </Link>
              </motion.div>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
