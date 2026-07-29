import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  experimental: { typedRoutes: true },
  // Call the platform API as server-side actions, prefix runtime URL.
  env: { NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080' },
};

export default nextConfig;
