import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    optimizePackageImports: ["framer-motion", "@xyflow/react"],
  },
};

export default nextConfig;
