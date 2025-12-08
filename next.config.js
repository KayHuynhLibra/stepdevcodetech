/** @type {import('next').NextConfig} */
const isStatic = process.env.STATIC_BUILD === 'true'

const nextConfig = {
  reactStrictMode: true,
}

// Cấu hình cho static export khi build cho GitHub Pages
if (isStatic) {
  nextConfig.output = 'export'
  nextConfig.images = { unoptimized: true }
  nextConfig.trailingSlash = true
}

module.exports = nextConfig

