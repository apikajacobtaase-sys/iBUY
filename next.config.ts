 import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
        pathname: "/**", 
      },
    ],
  },

  // ✅ ADD THIS: Allow larger image uploads (up to 10MB)
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },

  // 👇 KEEP THESE: To ignore build errors during deployment
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;