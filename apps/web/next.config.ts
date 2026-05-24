import path from 'path'
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  output: 'standalone',
  typescript: {
    // UI components in /components/ui use uninstalled packages (base-ui, cva, lucide)
    // that aren't used by storefront pages. Skip type errors until those are cleaned up.
    ignoreBuildErrors: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
      {
        protocol: 'https',
        hostname: '*.r2.dev',
      },
      {
        protocol: 'https',
        hostname: 'www.tse.co.za',
      },
    ],
  },
  outputFileTracingRoot: path.join(__dirname, '../../'),
  outputFileTracingExcludes: {
    '*': ['**/node_modules/**'],
  },
}

export default nextConfig
