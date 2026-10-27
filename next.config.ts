import type { NextConfig } from 'next'

const cabecerasDeSeguridad = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
  { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
]

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  poweredByHeader: false,
  devIndicators: false,
  turbopack: {
    rules: {
      '*.css': {
        loaders: ['@tailwindcss/turbopack'],
        as: '*.css',
      },
    },
  },
  // El prototipo original se sirve tal cual, como HTML estático.
  async rewrites() {
    return [{ source: '/antes', destination: '/antes/index.html' }]
  },
  async headers() {
    return [{ source: '/:ruta*', headers: cabecerasDeSeguridad }]
  },
}

export default nextConfig
