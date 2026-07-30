import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Standalone only needed for Docker; Node-on-Render uses `next start`
  output: process.env.DOCKER_BUILD === "1" ? "standalone" : undefined,
  serverExternalPackages: ["better-sqlite3", "sharp"],
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
