import type { Metadata, Viewport } from 'next'
import { Onest } from 'next/font/google'
import { urlApp } from '@/lib/config'
import './globals.css'

const onest = Onest({
  variable: '--font-onest',
  subsets: ['latin'],
  display: 'swap',
})

export const metadata: Metadata = {
  metadataBase: new URL(urlApp()),
  title: { default: 'Núcleo · pilates reformer en Buenos Aires', template: '%s · Núcleo' },
  description:
    'Reservá tu clase de pilates reformer en Núcleo: 6 reformers por clase, horarios de la semana en tiempo real, packs y lista de espera.',
  applicationName: 'Núcleo',
  openGraph: {
    type: 'website',
    locale: 'es_AR',
    siteName: 'Núcleo',
    title: 'Núcleo · pilates reformer en Buenos Aires',
    description: 'Horarios de la semana, reservas con pago y lista de espera. Proyecto de demostración.',
  },
}

export const viewport: Viewport = {
  themeColor: '#f5f7f6',
}

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="es-AR" className={onest.variable}>
      <body className="min-h-dvh antialiased">
        <a
          href="#contenido"
          className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-boton focus:bg-superficie focus:px-4 focus:py-2"
        >
          Saltar al contenido
        </a>
        <p className="bg-grafito px-4 py-1.5 text-center text-leyenda text-white/85">
          Proyecto de demostración: los pagos funcionan en modo de prueba
        </p>
        {children}
      </body>
    </html>
  )
}
