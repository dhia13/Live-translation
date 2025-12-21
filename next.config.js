/** @type {import('next').NextConfig} */
const nextConfig = {
  // Use 'export' for static export (Electron production)
  // Remove 'standalone' as it's for server-side rendering
  output: process.env.NODE_ENV === 'production' && process.env.ELECTRON_BUILD ? 'export' : undefined,
  // Disable strict mode for Electron compatibility
  reactStrictMode: false,
  // Disable image optimization for Electron
  images: {
    unoptimized: true,
  },
  // Transpile edge-tts package (it's TypeScript)
  transpilePackages: ['edge-tts'],
  // Webpack configuration to handle WebSocket dependencies
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Handle optional dependencies for WebSocket
      config.externals = config.externals || [];
      config.externals.push({
        'bufferutil': 'commonjs bufferutil',
        'utf-8-validate': 'commonjs utf-8-validate',
      });
    }
    return config;
  },
}

module.exports = nextConfig

