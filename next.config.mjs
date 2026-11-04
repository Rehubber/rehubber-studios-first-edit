/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  trailingSlash: true,
  experimental: {
    agentUpgrade: "security",
  },
  images: {
    unoptimized: true,
  },
}

export default nextConfig
