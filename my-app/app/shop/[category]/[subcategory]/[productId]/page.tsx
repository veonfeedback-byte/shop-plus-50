import { Metadata } from "next";
import Catalog, { Product } from "@/app/lib/catalog";
import ProductClient from "./ProductClient";

type Props = {
  params: Promise<{ category: string; subcategory: string; productId: string }>;
};

// 🔑 SEO: generateMetadata runs on the server
export async function generateMetadata({ params }: { params: any }): Promise<Metadata> {
  const { category, subcategory, productId } = await params;
  const product: Product | undefined = Catalog.getProducts(category, subcategory)
    .find((p) => p.id === productId);

  if (!product) {
    return {
      title: "Product not found | Trolly",
      description: "This product is not available.",
    };
  }

  return {
    title: `${product.title} | Trolly`,
    description: product.description
      ? product.description.slice(0, 150)
      : `Buy ${product.title} online at the best price in Pakistan. Available now on Trolly.`,
    openGraph: {
      title: product.title,
      description: product.description || product.title,
      images: product.images?.length ? [{ url: product.images[0] }] : [],
    },
    twitter: {
      card: "summary_large_image",
      title: product.title,
      description: product.description || product.title,
      images: product.images?.length ? [product.images[0]] : [],
    },
  };
}

export default async function ProductPage({ params }: Props) {
  const { category, subcategory, productId } = await params;
  const product: Product | undefined = Catalog.getProducts(category, subcategory)
    .find((p) => p.id === productId);

  if (!product) {
    return <div className="p-6">Product not found</div>;
  }

  return <ProductClient product={product} params={{ category, subcategory, productId }} />;
}
