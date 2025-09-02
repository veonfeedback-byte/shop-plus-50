"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/", label: "Home", emoji: "🏠" },
  { href: "/shop", label: "Shop", emoji: "🛍️" },
  { href: "/cart", label: "Cart", emoji: "🛒" },
  { href: "/profile", label: "Profile", emoji: "👤" },
];

export default function BottomNav() {
  const path = usePathname();
  return (
    <nav className="fixed bottom-0 left-0 right-0 border-t bg-white/95 backdrop-blur">
      <div className="grid grid-cols-4 max-w-5xl mx-auto text-sm">
        {items.map(it => (
          <Link key={it.href} href={it.href}
            className={`flex flex-col items-center py-2 ${path === it.href ? "font-semibold" : "text-gray-600"}`}>
            <div className="text-xl">{it.emoji}</div>
            <div>{it.label}</div>
          </Link>
        ))}
      </div>
    </nav>
  );
}
