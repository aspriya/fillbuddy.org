import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

// Exposes Cloudflare bindings (D1, KV, R2, etc.) to `next dev` via
// getCloudflareContext(). Per the @opennextjs/cloudflare docs this should
// be called from the Next config and does not need to be awaited.
initOpenNextCloudflareForDev();

const nextConfig: NextConfig = {
  turbopack: {
    resolveAlias: {
      canvas: "./src/lib/canvas-shim.js",
    },
  },
  webpack: (config) => {
    config.resolve.alias.canvas = false;
    return config;
  },
};

export default nextConfig;
