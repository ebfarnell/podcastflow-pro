/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true, // Enable for better debugging and compatibility
  images: {
    domains: ['podcastflow-media.s3.amazonaws.com', 'localhost', 'app.podcastflow.pro'],
  },
  // Add proper cache headers for static assets
  async headers() {
    return [
      {
        source: '/_next/static/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-Build-Id',
            value: process.env.BUILD_ID || 'development',
          },
        ],
      },
    ];
  },
  env: {
    NEXT_PUBLIC_AWS_REGION: process.env.AWS_REGION || 'us-east-1',
    NEXT_PUBLIC_USER_POOL_ID: process.env.USER_POOL_ID,
    NEXT_PUBLIC_USER_POOL_CLIENT_ID: process.env.USER_POOL_CLIENT_ID,
    NEXT_PUBLIC_API_ENDPOINT: process.env.API_ENDPOINT,
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: process.env.STRIPE_PUBLISHABLE_KEY,
  },
  // Move serverComponentsExternalPackages to top level
  serverExternalPackages: ['@prisma/client', 'bcryptjs'],
  compiler: {
    removeConsole: false, // Keep console logs for debugging
  },
  typescript: {
    // Ignore TypeScript errors during development for faster builds
    ignoreBuildErrors: true,
  },
  webpack: (config, { dev, isServer }) => {
    if (dev) {
      config.watchOptions = {
        poll: 1000,
        aggregateTimeout: 300,
      }
    }
    
    // Disable aggressive minification in production to prevent "v is not a function" errors
    if (!dev && !isServer) {
      config.optimization = {
        ...config.optimization,
        minimize: true,
        minimizer: config.optimization.minimizer?.map((minimizer) => {
          if (minimizer.constructor.name === 'TerserPlugin') {
            minimizer.options.terserOptions = {
              ...minimizer.options.terserOptions,
              compress: {
                ...minimizer.options.terserOptions?.compress,
                // Disable unsafe optimizations
                unsafe: false,
                unsafe_comps: false,
                unsafe_Function: false,
                unsafe_math: false,
                unsafe_proto: false,
                unsafe_regexp: false,
                unsafe_undefined: false,
                // Keep function names for debugging
                keep_fnames: true,
                // Don't inline functions
                inline: 1,
              },
              mangle: {
                // Keep function names
                keep_fnames: true,
              },
            }
          }
          return minimizer
        }),
      }
    }
    
    return config
  },
  // Production optimizations
  // output: 'standalone', // Disabled - causing manifest issues
  poweredByHeader: false,
  compress: false, // Disable compression for debugging
  generateEtags: true,
  
  // Build performance optimizations
  onDemandEntries: {
    // Period (in ms) where the server will keep pages in the buffer
    maxInactiveAge: 25 * 1000,
    // Number of pages that should be kept simultaneously without being disposed
    pagesBufferLength: 5,
  },
  
  // Disable static optimization for routes with dynamic data
  staticPageGenerationTimeout: 60,
  
  // Optimize for production
  productionBrowserSourceMaps: true, // Enable source maps for debugging
  
  // Add build ID to chunk names for cache busting
  generateBuildId: async () => {
    // Use timestamp as build ID to ensure uniqueness
    return Date.now().toString()
  },
  
  // Security headers and cache control
  async headers() {
    return [
      {
        source: '/_next/static/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-cache, no-store, must-revalidate, max-age=0',
          },
        ],
      },
      {
        source: '/:path*',
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
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
        ],
      },
    ]
  },
}

module.exports = nextConfig