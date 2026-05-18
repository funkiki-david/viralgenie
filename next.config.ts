import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["apify-client"],
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
