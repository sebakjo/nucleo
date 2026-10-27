import type { Metadata } from 'next'
import Link from 'next/link'
import { connection } from 'next/server'
import { Suspense } from 'react'
import { BotonComprar } from '@/components/pagos/BotonComprar'
import { db } from '@/db'
import { precio } from '@/lib/dinero'
import { saldoCreditos } from '@/lib/dominio/creditos'
import { precioClaseSuelta, productosActivos } from '@/lib/dominio/precios'
import { usuarioActual } from '@/lib/sesion'
import { diaYMes } from '@/lib/tiempo'

export const metadata: Metadata = {
  title: 'Packs de clases',
  description: 'Packs de 4, 8 y 12 clases de pilates reformer para usar en 30 días.',
}

export default function PaginaPacks() {
  return (
    <>
      <h1 className="text-titulo font-bold">Packs de clases</h1>
      <p className="mt-2 max-w-[60ch] text-grafito-2">
        Cada crédito es una clase, en cualquier horario. Los packs vencen a los 30 días de la compra y se
        pagan con Mercado Pago.
      </p>
      <Suspense fallback={<div className="mt-8 h-96 esqueleto" />}>
        <Lista />
      </Suspense>
    </>
  )
}

/** Un mini carril por crédito: el tamaño del pack se ve antes de leer el número. */
function Creditos({ n }: { n: number }) {
  return (
    <span className="flex flex-wrap gap-[3px]" aria-hidden="true">
      {Array.from({ length: n }, (_, i) => (
        <span
          key={i}
          className="h-5 w-[7px] rounded-[2px] border-[1.5px] border-eucalipto bg-eucalipto-tenue"
        />
      ))}
    </span>
  )
}

async function Lista() {
  await connection()
  const [productos, suelta, usuario] = await Promise.all([
    productosActivos(db),
    precioClaseSuelta(db),
    usuarioActual(),
  ])
  const saldo = usuario ? await saldoCreditos(db, usuario.id, new Date()) : null

  return (
    <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_320px]">
      <ul className="divide-y divide-linea rounded-bloque border border-linea bg-superficie">
        {productos.map((p) => {
          const porClase = Math.round(p.precioArs / p.creditos)
          const ahorro = Math.round((1 - porClase / suelta) * 100)
          return (
            <li key={p.id} className="grid gap-4 p-6 sm:grid-cols-[1fr_auto] sm:items-center">
              <div>
                <h2 className="text-seccion font-semibold">{p.nombre}</h2>
                <div className="mt-2">
                  <Creditos n={p.creditos} />
                </div>
                <p className="mt-3 text-chico text-grafito-2">
                  <span className="font-semibold text-grafito tabular">{precio(porClase)}</span> por clase
                  {ahorro > 0 && ` · ${ahorro} % menos que la clase suelta`} · válido {p.validezDias} días
                </p>
              </div>
              <div className="flex flex-col gap-3 sm:items-end">
                <p className="text-dato font-semibold tabular">{precio(p.precioArs)}</p>
                {usuario ? (
                  <BotonComprar productoId={p.id} texto={`Comprar ${p.nombre.toLowerCase()}`} />
                ) : (
                  <Link href="/entrar?volver=/packs" className="boton boton-secundario">
                    Entrá para comprar
                  </Link>
                )}
              </div>
            </li>
          )
        })}
      </ul>
      <aside className="space-y-4 text-chico text-grafito-2">
        {saldo && (
          <div className="rounded-bloque border border-linea bg-superficie p-5 text-cuerpo text-grafito">
            <p className="font-semibold">
              Tenés {saldo.disponibles} {saldo.disponibles === 1 ? 'crédito' : 'créditos'}
            </p>
            {saldo.proximoVencimiento && (
              <p className="mt-1 text-chico text-grafito-2">
                El próximo vence el {diaYMes(saldo.proximoVencimiento)}.
              </p>
            )}
          </div>
        )}
        <p>
          La clase suelta cuesta <span className="font-semibold text-grafito tabular">{precio(suelta)}</span>.
        </p>
        <p>Si cancelás una clase con más de 12 horas de anticipación, el crédito vuelve a tu pack.</p>
        <p>
          El pack se activa cuando Mercado Pago confirma el pago. Si el pago queda en proceso, te avisamos por
          email.
        </p>
      </aside>
    </div>
  )
}
