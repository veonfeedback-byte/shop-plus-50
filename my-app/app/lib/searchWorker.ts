// app/lib/searchWorker.ts
import Fuse from "fuse.js";

export type IndexedProduct = {
  id: string;
  title: string;
  categorySlug: string;
  subcategorySlug: string;
  mainImage?: string | null;
  price?: number;
};

export type SearchRequest = {
  query: string;
  products: IndexedProduct[];
};

self.onmessage = (e: MessageEvent<SearchRequest>) => {
  const { query, products } = e.data;

  if (!query || query.trim().length < 2) {
    self.postMessage([]);
    return;
  }

  // Fuse instance (only keys we need)
  const fuse = new Fuse(products, {
    keys: ["title"],
    threshold: 0.35,
    ignoreLocation: true,
    minMatchCharLength: 2,
  });

  const results = fuse.search(query, { limit: 50 }).map(r => r.item);
  self.postMessage(results);
};
