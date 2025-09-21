// app/shop/products/[category]/[subcategory]/page.tsx
import { Metadata } from "next";
import Catalog from "@/app/lib/catalog";
import SubcategoryClient from "./SubcategoryClient";

interface Params {
  category: string;
  subcategory: string;
}

// ---------------- SERVER-SIDE METADATA ----------------
export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const resolvedParams = await params; // <--- await here
  const { category: categorySlug, subcategory: subcategorySlug } = resolvedParams;

  const category = Catalog.getCategories().find(c => c.slug === categorySlug);
  const subcategory = category?.subcategories.find(s => s.slug === subcategorySlug);
  const products = subcategory?.products || [];

  const structuredProducts = products
    .map(p => {
      const mainImage = (p as any).img ?? (Array.isArray((p as any).images) ? (p as any).images[0] : null);
      const priceNum = p.price ? Number(p.price) : null;
      if (!mainImage || !priceNum) return null;
      return {
        "@type": "Product",
        name: p.title,
        image: mainImage,
        offers: {
          "@type": "Offer",
          price: priceNum,
          priceCurrency: "PKR",
          availability: "https://schema.org/InStock",
        },
      };
    })
    .filter(Boolean);

  if (!subcategory || !category) {
    return {
      title: "Subcategory not found | Trolly",
      description: "This subcategory does not exist.",
    };
  }

  const pageUrl = `https://trollypk.vercel.app/shop/products/${categorySlug}/${subcategorySlug}`;

  return {
    title: `${subcategory.name} – Buy ${subcategory.name} Online in Pakistan | Trolly`,
    description: `Shop the best ${subcategory.name} collection online at Trolly. Explore latest products in ${subcategory.name} from ${category.name} category at affordable prices.`,
    openGraph: {
      title: `${subcategory.name} – Trolly`,
      description: `Discover the best deals in ${subcategory.name} at Trolly.pk – trusted online shopping in Pakistan.`,
      url: pageUrl,
      images: structuredProducts.map(p => ({ url: (p as any).image })),
    },
    twitter: {
      card: "summary_large_image",
      title: `${subcategory.name} – Trolly`,
      description: `Shop the best ${subcategory.name} collection online at Trolly.pk`,
      images: structuredProducts.map(p => (p as any).image),
    },
    alternates: { canonical: pageUrl },
    metadataBase: new URL(pageUrl),
  };
}

// ---------------- CLIENT RENDER ----------------
export default async function Page({ params }: { params: Promise<Params> }) {
  const resolvedParams = await params; // <--- await here
  return <SubcategoryClient params={resolvedParams} />;
}
