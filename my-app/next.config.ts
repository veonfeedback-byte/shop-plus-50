/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "content.public.markaz.app" },
      { protocol: "https", hostname: "content.markaz.app" },
      { protocol: "https", hostname: "cdn.markaz.app" },
    ],
  },
};

module.exports = nextConfig;
