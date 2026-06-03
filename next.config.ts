import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "avatars.steamstatic.com",
      },
      {
        protocol: "https",
        hostname: "cdn.akamai.steamstatic.com",
      },
    ],
  },
};

export default nextConfig;
