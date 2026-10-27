'use client'

import { useSyncExternalStore } from 'react'

const sinCambios = () => () => {}

/**
 * Los diálogos se montan dentro de #panel para heredar el tema oscuro. Durante la hidratación
 * devuelve null (igual que el servidor) y después el elemento real.
 */
export function useContenedorPanel(): HTMLElement | null {
  return useSyncExternalStore(
    sinCambios,
    () => document.getElementById('panel'),
    () => null,
  )
}
