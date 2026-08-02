import type { NextConfig } from "next";
import { withSerwist } from "@serwist/turbopack";
import { fileURLToPath } from "node:url";
import path from "node:path";

const monorepoRoot = path.resolve(fileURLToPath(new URL(".", import.meta.url)), "..");

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1"],
  turbopack: {
    root: monorepoRoot,
  },
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${process.env.BACKEND_INTERNAL_URL ?? "http://localhost:4000"}/:path*` }];
  },
};

export default withSerwist(nextConfig);
