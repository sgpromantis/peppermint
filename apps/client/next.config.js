// next.config.js
const removeImports = require('next-remove-imports')();
const nextTranslate = require('next-translate');
const withPWA = require('@ducanh2912/next-pwa').default({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: false,
});

const nextConfig = {
  reactStrictMode: false,
  output: 'standalone',
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  async rewrites() {
    return [
      {
        source: '/api/v1/:path*',
        destination: 'http://localhost:5003/api/v1/:path*',
      },
    ];
  },
};

module.exports = removeImports(nextTranslate(withPWA(nextConfig)));
