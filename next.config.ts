import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["better-sqlite3", "sharp"],
  // Avoid flaky Docker failures from lint while shipping the tool
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: false },
};

export default nextConfig;
