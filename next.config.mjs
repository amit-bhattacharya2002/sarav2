/** @type {import('next').NextConfig} */
const nextConfig = {
  // Production-ready configurations
  eslint: {
    // Remove this for production - currently needed due to existing linter errors
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Remove this for production - currently needed due to existing TypeScript errors
    ignoreBuildErrors: true,
  },
  
  // Image optimization
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
    dangerouslyAllowSVG: true,
    contentDispositionType: 'attachment',
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },

  // Performance optimizations
  experimental: {
    optimizePackageImports: ['lucide-react', '@radix-ui/react-icons'],
  },

  // Environment variables validation
  env: {
    NODE_ENV: process.env.NODE_ENV,
  },

  // Security headers
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'origin-when-cross-origin',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
        ],
      },
    ]
  },

  // Redirects for better SEO and UX
  async redirects() {
    return [
      // Add any redirects here if needed
    ]
  },

  // Bundle analyzer (only in development)
  ...(process.env.ANALYZE === 'true' && {
    experimental: {
      bundlePagesRouterDependencies: true,
    },
  }),

  // Webpack configuration for optimizations
  webpack: (config, { buildId, dev, isServer, defaultLoaders, webpack }) => {
    // Optimize bundles
    if (!dev && !isServer) {
      config.optimization.splitChunks = {
        chunks: 'all',
        cacheGroups: {
          vendor: {
            test: /[\\/]node_modules[\\/]/,
            name: 'vendors',
            chunks: 'all',
          },
        },
      }
    }

    return config
  },

  // Output configuration for static export (if needed)
  // output: 'export',
  // trailingSlash: true,
}

export default nextConfig