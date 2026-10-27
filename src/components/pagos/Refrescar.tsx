'use client'

import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

/** Mientras un pago está en proceso, vuelve a consultar cada pocos segundos (hasta 2 minutos). */
export function Refrescar({ cadaMs = 4000 }: { cadaMs?: number }) {
  const router = useRouter()
  useEffect(() => {
    const inicio = Date.now()
    const id = window.setInterval(() => {
      if (Date.now() - inicio > 120_000) window.clearInterval(id)
      else router.refresh()
    }, cadaMs)
    return () => window.clearInterval(id)
  }, [router, cadaMs])
  return null
}
