'use client'

import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

/** j / ← semana anterior, k / → siguiente, t esta semana. No interfiere al escribir ni con un diálogo abierto. */
export function AtajosAgenda({
  anterior,
  siguiente,
  actual,
}: {
  anterior: string
  siguiente: string
  actual: string
}) {
  const router = useRouter()
  useEffect(() => {
    const alPresionar = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || e.defaultPrevented) return
      const t = e.target as HTMLElement
      if (
        t.closest('input, textarea, select, [contenteditable="true"], [role="dialog"], [role="alertdialog"]')
      )
        return
      if (document.querySelector('[role="dialog"], [role="alertdialog"]')) return
      const destino = { j: anterior, ArrowLeft: anterior, k: siguiente, ArrowRight: siguiente, t: actual }[
        e.key
      ]
      if (!destino) return
      e.preventDefault()
      router.push(destino, { scroll: false })
    }
    window.addEventListener('keydown', alPresionar)
    return () => window.removeEventListener('keydown', alPresionar)
  }, [anterior, siguiente, actual, router])
  return null
}
