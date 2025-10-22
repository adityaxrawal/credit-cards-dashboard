/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      // Allow both common localhost dev ports
      allowedOrigins: ['localhost:3000', 'localhost:3001'],
    },
  },
  images: {
    domains: ['lh3.googleusercontent.com'],
  },
}

module.exports = nextConfig