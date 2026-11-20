import type { NextConfig } from "next";

// RecoSense AI renders data client-side from the FastAPI backend (JWT auth), so the opt-in
// cacheComponents / partialPrefetching features from the scaffold are intentionally not enabled.
const nextConfig: NextConfig = {
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  poweredByHeader: false,
  // Self-contained server bundle for Docker; Vercel ignores this setting.
  output: "standalone",
};

export default nextConfig;
