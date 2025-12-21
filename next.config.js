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
}

module.exports = nextConfig

