import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // A production build must never overwrite chunks served by `next dev`.
  distDir: process.env.NODE_ENV === 'development' ? '.next-dev' : '.next',
  eslint: {
    ignoreDuringBuilds: false,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
}

export default nextConfig
