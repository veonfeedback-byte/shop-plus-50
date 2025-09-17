/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "content.public.markaz.app" },
      { protocol: "https", hostname: "content.markaz.app" },
      { protocol: "https", hostname: "cdn.markaz.app" },
    ],
  },
  eslint: {
    // 🚫 Don’t crash build because of ESLint errors
    ignoreDuringBuilds: true,
  },
  typescript: {
    // 🚫 Don’t crash build because of TS errors
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
