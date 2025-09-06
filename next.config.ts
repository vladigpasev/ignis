import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Skip ESLint during production builds to avoid blocking deploys
  eslint: {
    ignoreDuringBuilds: true,
  },
  /* config options here */
};

export default nextConfig;
