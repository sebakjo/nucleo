import type { NextConfig } from 'next'

const cabecerasDeSeguridad = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
  { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
]

const nextConfig: NextConfig = {
  // Los e2e compilan en otra carpeta para no pisar la build normal ni el servidor de desarrollo.
  distDir: process.env.NEXT_DIST_DIR || '.next',
  // La imagen de Docker usa el servidor standalone; en Vercel y con `pnpm start` no hace falta.
  output: process.env.NEXT_OUTPUT === 'standalone' ? 'standalone' : undefined,
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
