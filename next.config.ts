/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Force client-side rendering
  reactStrictMode: false,
  // Webpack configuration to handle Web3 libraries
  webpack: (config: any, { isServer }: { isServer: boolean }) => {
    if (isServer) {
      // Server-side specific configurations
      config.externals = [...(config.externals || []), 'canvas', 'jsdom'];
    }
    
    // Handle Node.js modules that should be ignored in the browser
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      net: false,
      tls: false,
      crypto: false,
      stream: false,
      url: false,
      zlib: false,
      http: false,
      https: false,
      assert: false,
      os: false,
      path: false,
      // Add Web3-specific fallbacks
      'node:crypto': false,
      'node:stream': false,
      'node:util': false,
      'node:buffer': false,
    };
    
    // Ignore Web3-specific modules during server-side rendering
    if (isServer) {
      config.plugins.push(
        new (require('webpack').IgnorePlugin)({
          resourceRegExp: /^(indexeddb|localforage|idb-keyval)$/,
        })
      );
    }
    
    return config;
  },
}

module.exports = nextConfig
