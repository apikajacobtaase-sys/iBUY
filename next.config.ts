// next.config.ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
        pathname: "/**", // Allows all paths under this domain
      },
      // Add other domains here if you use them (e.g., your own CDN)
    ],
  },
};

export default nextConfig;