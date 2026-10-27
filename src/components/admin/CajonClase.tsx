'use client'

import { Dialog } from 'radix-ui'
import { useRouter } from 'next/navigation'
import type { ReactNode } from 'react'
import { useContenedorPanel } from './contenedor'

/** Panel lateral con la lista de la clase. Se abre con ?clase= para que el enlace se pueda compartir. */
export function CajonClase({
  titulo,
  descripcion,
  cerrar,
  children,
}: {
  titulo: string
  descripcion: string
  cerrar: string
  children: ReactNode
}) {
  const router = useRouter()
  const contenedor = useContenedorPanel()
  return (
    <Dialog.Root defaultOpen onOpenChange={(abierto) => !abierto && router.push(cerrar, { scroll: false })}>
      <Dialog.Portal container={contenedor}>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-grafito/30" />
        <Dialog.Content className="fixed inset-y-0 right-0 z-50 flex w-full max-w-[480px] flex-col border-l border-linea bg-superficie text-grafito focus-visible:outline-none">
          <div className="flex items-start justify-between gap-4 border-b border-linea px-5 py-4 sm:px-6">
            <div className="min-w-0">
              <Dialog.Title className="text-seccion font-semibold">{titulo}</Dialog.Title>
              <Dialog.Description className="mt-0.5 text-chico text-grafito-2">
                {descripcion}
              </Dialog.Description>
            </div>
            <Dialog.Close className="boton min-h-10 w-10 shrink-0 boton-secundario px-0" aria-label="Cerrar">
              <svg viewBox="0 0 16 16" className="h-4 w-4" aria-hidden="true">
                <path d="m4 4 8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
              </svg>
            </Dialog.Close>
          </div>
          <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-6">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
