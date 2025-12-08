/** @type {import('next').NextConfig} */
const isStatic = process.env.STATIC_BUILD === 'true'

const nextConfig = {
  reactStrictMode: true,
  ...(isStatic
    ? {
        // Cấu hình cho static export
        output: 'export',
        images: { unoptimized: true },
        trailingSlash: true,
      }
    : {}),
}

module.exports = nextConfig

