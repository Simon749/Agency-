import type { NextConfig } from "next";

type NextConfigWithEslint = NextConfig & {
  eslint?: {
    ignoreDuringBuilds?: boolean;
  };
};

const nextConfig: NextConfigWithEslint = {
  // ── Image Optimization ────────────────────────────────────────────────────
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      { protocol: "https", hostname: "*.vercel-storage.com" },
      { protocol: "https", hostname: "*.cloudinary.com" },
      { protocol: "https", hostname: "*.blob.vercel-storage.com" },
    ],
    // Cache optimized images for 1 year (immutable)
    minimumCacheTTL: 31536000,
  },

  // ── Compression ───────────────────────────────────────────────────────────
  compress: true,

  // ── Experimental Performance Features ────────────────────────────────────
  experimental: {
    // Optimize heavy package imports (tree-shaking hints)
    optimizePackageImports: [
      "lucide-react",
      "recharts",
      "@clerk/nextjs",
    ],
  },

  // ── Bundle Analysis (run with ANALYZE=true npm run build) ───────────────
  ...(process.env.ANALYZE === "true" && {
    webpack: (config, { isServer }) => {
      const { BundleAnalyzerPlugin } = require("webpack-bundle-analyzer");
      config.plugins.push(
        new BundleAnalyzerPlugin({
          analyzerMode: "static",
          reportFilename: isServer ? "../analyze/server.html" : "./analyze/client.html",
          openAnalyzer: false,
        })
      );
      return config;
    },
  }),

  // ── HTTP Headers (caching strategy) ──────────────────────────────────────
  async headers() {
    return [
      {
        // Dynamic pages: no cache, must revalidate
        source: "/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=0, must-revalidate",
          },
        ],
      },
      {
        // Static Next.js chunks: immutable, 1 year
        source: "/_next/static/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        // Static assets in public folder: 1 day
        source: "/static/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=86400",
          },
        ],
      },
      {
        // Health check endpoint: no cache
        source: "/api/health",
        headers: [
          {
            key: "Cache-Control",
            value: "no-store, no-cache, must-revalidate",
          },
        ],
      },
    ];
  },

  // ── Redirects ─────────────────────────────────────────────────────────────
  async redirects() {
    return [
      {
        source: "/admin",
        destination: "/admin/dashboard",
        permanent: true,
      },
      {
        source: "/tenant",
        destination: "/tenant/dashboard",
        permanent: true,
      },
      {
        source: "/super-admin",
        destination: "/super-admin/dashboard",
        permanent: true,
      },
    ];
  },

  // ── Powered By Header ─────────────────────────────────────────────────────
  poweredByHeader: false,

  // ── Production Source Maps (disable for smaller bundles) ────────────────
  productionBrowserSourceMaps: false,

  // ── ESLint (don't block builds on lint errors during Phase 2 testing) ────
  eslint: {
    ignoreDuringBuilds: process.env.CI !== "true",
  },

  // ── TypeScript (don't block builds on type errors during Phase 2 testing) ─
  typescript: {
    ignoreBuildErrors: process.env.CI !== "true",
  },
};

export default nextConfig;