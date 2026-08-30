import type { NextConfig } from "next";

const sensitivePageHeaders = [
  { key: "Cache-Control", value: "no-store" },
  { key: "Referrer-Policy", value: "no-referrer" },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      { source: "/activate", headers: sensitivePageHeaders },
      { source: "/auth/callback", headers: sensitivePageHeaders },
    ];
  },
};

export default nextConfig;
