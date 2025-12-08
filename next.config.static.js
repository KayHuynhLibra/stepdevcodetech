/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'export', // Export static HTML
  images: {
    unoptimized: true, // Cần cho static export
  },
  trailingSlash: true,
}

module.exports = nextConfig

