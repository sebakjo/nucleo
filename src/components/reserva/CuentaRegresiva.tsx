'use client'

import { useEffect, useState } from 'react'

/** "9:32" hasta que vence la retención del lugar. Al llegar a cero, avisa con `onVencida`. */
export function CuentaRegresiva({ hasta, onVencida }: { hasta: string; onVencida?: () => void }) {
  const fin = new Date(hasta).getTime()
  const [restante, setRestante] = useState<number | null>(null)
  useEffect(() => {
    const tick = () => {
      const r = Math.max(0, fin - Date.now())
      setRestante(r)
      if (r === 0) onVencida?.()
      return r
    }
    if (tick() === 0) return
    const id = window.setInterval(() => {
      if (tick() === 0) window.clearInterval(id)
    }, 1000)
    return () => window.clearInterval(id)
  }, [fin, onVencida])
  if (restante === null) return <span className="tabular">–:––</span>
  const s = Math.ceil(restante / 1000)
  return (
    <span className="tabular" aria-label={`${Math.floor(s / 60)} minutos y ${s % 60} segundos`}>
      {Math.floor(s / 60)}:{String(s % 60).padStart(2, '0')}
    </span>
  )
}
