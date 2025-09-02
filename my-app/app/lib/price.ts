// app/lib/price.ts
export function plus50(rawPrice: number): number {
  if (typeof rawPrice !== "number" || isNaN(rawPrice)) return 0;
  return Math.round(rawPrice * 1.5);
}
