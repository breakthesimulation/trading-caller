import type { NextConfig } from "next";

const API_URL =
  process.env.API_URL ||
  (process.env.NODE_ENV === "production"
    ? "https://trading-caller-production-d7d3.up.railway.app"
    : "http://localhost:3000");

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${API_URL}/:path*`,
      },
    ];
  },
};

export default nextConfig;
