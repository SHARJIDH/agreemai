/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { buildId, dev, isServer, defaultLoaders, webpack }) => {
    config.resolve = {
      ...config.resolve,
      preferRelative: true,
      fallback: {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
      },
    };
    return config;
  },
  // Disable strict mode to avoid double rendering in development
  reactStrictMode: false,
}

module.exports = nextConfig
