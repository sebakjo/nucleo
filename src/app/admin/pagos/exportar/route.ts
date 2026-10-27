import { DETALLE_RECHAZO, ESTADO_PAGO } from '@/components/admin/estados'
import { listarPagos } from '@/lib/consultas/admin'
import { aCsv } from '@/lib/csv'
import { consumirLimite } from '@/lib/limite'
import { usuarioActual } from '@/lib/sesion'
import { claveDia, hora } from '@/lib/tiempo'

/** Descarga los pagos (con el filtro de estado de la página) como CSV. Solo admin. */
export async function GET(req: Request) {
  const u = await usuarioActual()
  if (!u) return Response.json({ error: 'no_autorizado' }, { status: 401 })
  if (u.rol !== 'admin') return Response.json({ error: 'prohibido' }, { status: 403 })
  if (!(await consumirLimite(`panel:${u.id}`, 120, 60))) {
    return Response.json({ error: 'limite' }, { status: 429 })
  }

  const estado = new URL(req.url).searchParams.get('estado') ?? undefined
  const { filas } = await listarPagos({ estado, todos: true })
  const fecha = (d: Date | null) => (d ? `${claveDia(d)} ${hora(d)}` : '')
  const csv = aCsv([
    [
      'Fecha',
      'Persona',
      'Email',
      'Tipo',
      'Concepto',
      'Monto (ARS)',
      'Estado',
      'Detalle',
      'Aprobado',
      'Medio',
      'Operación',
    ],
    ...filas.map((p) => [
      fecha(p.creadoEn),
      p.nombre,
      p.email,
      p.tipo === 'pack' ? 'Pack' : 'Clase suelta',
      p.descripcion,
      p.montoArs,
      ESTADO_PAGO[p.estado]?.texto ?? p.estado,
      p.detalle && p.estado !== 'aprobado' ? (DETALLE_RECHAZO[p.detalle] ?? p.detalle) : '',
      fecha(p.aprobadoEn),
      p.proveedor === 'simulado' ? 'Simulado' : 'Mercado Pago',
      p.idExterno,
    ]),
  ])
  const sufijo = estado && ESTADO_PAGO[estado] ? `-${estado}` : ''
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="nucleo-pagos${sufijo}-${claveDia(new Date())}.csv"`,
      'Cache-Control': 'private, no-store',
    },
  })
}
