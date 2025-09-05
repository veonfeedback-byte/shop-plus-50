// app/lib/catalog.ts
import rawCatalog from "../data/catalog.json";
import { plus50 } from "./price";

/** ============= Types ============= */
export type Product = {
  id: string;
  title: string;
  code?: string;
  price: string;
  currency?: string | null;
  img: string;
  images: string[];
  link: string;
  description?: string;

  // ✅ new fields for navigation
  category: string;
  subcategory: string;
};

export type Subcategory = {
  name: string;
  slug: string;
  url: string;
  products: Product[];
};

export type Category = {
  name: string;
  slug: string;
  url: string;
  subcategories: Subcategory[];
};

export type Catalog = {
  scrapedAt: string;
  categories: Category[];
};

/** ============= Helpers ============= */
function ensureCatalog(data: any): Catalog {
  if (data && Array.isArray(data.categories)) {
    return data as Catalog;
  }
  return { scrapedAt: "", categories: [] };
}

function slugify(name: string): string {
  return (name || "")
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/'/g, "")
    .replace(/[^a-z0-9-]/g, "");
}

// normalize input for fuzzy matching
function norm(s: string): string {
  const cleaned = (s || "")
    .toLowerCase()
    .replace(/women'?s/g, "women")
    .replace(/men'?s/g, "men")
    .replace(/unstitch(?:ed|d)/g, "unstitched")
    .replace(/stitch(?:ed|d)/g, "stitched")
    .replace(/hand\s*bags?/g, "handbag")
    .replace(/shawls?/g, "shawl")
    .replace(/accessories?/g, "accessory")
    .replace(/undergarments?/g, "undergarment")
    .replace(/kids?/g, "kid")
    .replace(/home\s+essentials?/g, "home essential")
    .replace(/&/g, "and")
    .replace(/[^\w]/g, "");

  const alias: Record<string, string> = {
    menstitchd: "menstitched",
    mensunstitchd: "menunstitched",
    womensstitchd: "womenstitched",
    womensunstitchd: "womenunstitched",
    autobikeaccessory: "autoaccessory",
    homelinen: "homeessential",
    fashionaccessory: "accessory",
    festivecollection: "festive",
    freedelivery: "delivery",
  };

  return alias[cleaned] ?? cleaned;
}

function findCategory(source: Catalog | undefined, name: string): Category | undefined {
  if (!source || !Array.isArray(source.categories)) return undefined;
  const k = norm(name);
  return source.categories.find((c) => norm(c.name) === k);
}

function findSubcategory(cat: Category | undefined, subName: string): Subcategory | undefined {
  if (!cat || !Array.isArray(cat.subcategories)) return undefined;
  const k = norm(subName);
  return cat.subcategories.find((s) => norm(s.name) === k);
}

function extractCode(desc?: string): string | undefined {
  if (!desc) return undefined;
  const match = desc.match(/Code\s*[:\-]?\s*([A-Z0-9\-]+)/i);
  return match ? match[1] : undefined;
}

function safePlus50(input: unknown): string {
  const n =
    typeof input === "number"
      ? input
      : Number(String(input ?? "").replace(/[^\d.]/g, "")) || 0;
  return String(plus50(n));
}

export function normalizeProduct(
  p: any,
  category: string,
  subcategory: string
): Product {
  return {
    id: String(p.id ?? ""),
    title: String(p.title ?? "Untitled"),
    code: p.code ?? extractCode(p.description),
    price: safePlus50(p.price),
    currency: p.currency ?? null,
    img: p.image ?? p.img ?? (Array.isArray(p.images) ? p.images[0] : "") ?? "",
    images: Array.isArray(p.images) ? p.images : p.image ? [p.image] : [],
    link: String(p.link ?? "#"),
    description: p.description ?? "",
    category,
    subcategory,
  };
}

/** ============= Build merged catalog with slugs + product context ============= */
const A: Catalog = ensureCatalog(rawCatalog);

const MERGED: Catalog = {
  ...A,
  categories: (A.categories || []).map((c) => ({
    ...c,
    slug: slugify(c.name),
    subcategories: (c.subcategories || []).map((s) => ({
      ...s,
      slug: slugify(s.name),
      products: (s.products || []).map((p) =>
        normalizeProduct(p, slugify(c.name), slugify(s.name))
      ),
    })),
  })),
};

/** ============= Exports used by pages ============= */
export function getCategories(): Category[] {
  return MERGED.categories;
}

export function getCategoryBySlug(slug: string): Category | undefined {
  return MERGED.categories.find((c) => c.slug === slugify(decodeURIComponent(slug)));
}

export function getSubcategories(categorySlug: string): Subcategory[] {
  const cat = getCategoryBySlug(categorySlug) || findCategory(MERGED, categorySlug);
  return cat?.subcategories ?? [];
}

export function getProducts(categorySlug?: string, subcategorySlug?: string): Product[] {
  if (!categorySlug && !subcategorySlug) {
    return MERGED.categories.flatMap((c) => c.subcategories.flatMap((s) => s.products));
  }

  const cat = categorySlug && getCategoryBySlug(categorySlug);
  if (!cat) return [];

  if (!subcategorySlug) {
    return cat.subcategories.flatMap((s) => s.products);
  }

  const sub =
    cat.subcategories.find((s) => s.slug === slugify(subcategorySlug)) ||
    findSubcategory(cat, subcategorySlug);

  return sub?.products ?? [];
}

export function getProduct(id: string): Product | null {
  for (const c of MERGED.categories) {
    for (const s of c.subcategories) {
      const found = s.products.find((p) => p.id === id);
      if (found) return found; // already normalized with category+subcategory
    }
  }
  return null;
}

export function getTrending(limit = 20): Product[] {
  const all: Product[] = [];
  for (const cat of MERGED.categories) {
    for (const sub of cat.subcategories ?? []) {
      all.push(...sub.products);
    }
  }
  return all.slice(0, limit);
}

// ✅ Export as object
const Catalog = {
  getCategories,
  getCategoryBySlug,
  getSubcategories,
  getProducts,
  getProduct,
  getTrending,
};

export default Catalog;
