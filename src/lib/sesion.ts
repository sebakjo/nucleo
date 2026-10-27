import 'server-only'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { cache } from 'react'
import type { Rol } from '@/db/schema'
import { auth } from './auth'

export type UsuarioSesion = { id: string; nombre: string; email: string; rol: Rol }

/** Usuario de la sesión actual (o null). Se lee una vez por petición. */
export const usuarioActual = cache(async (): Promise<UsuarioSesion | null> => {
  const sesion = await auth.api.getSession({ headers: await headers() })
  if (!sesion) return null
  const rol = (sesion.user as { role?: Rol }).role ?? 'alumno'
  return { id: sesion.user.id, nombre: sesion.user.name, email: sesion.user.email, rol }
})

/** Solo una ruta interna (empieza con "/" y no con "//"): evita redirecciones abiertas. */
export function rutaSegura(volver: string | null | undefined, porDefecto = '/'): string {
  return volver && volver.startsWith('/') && !volver.startsWith('//') ? volver : porDefecto
}

export async function exigirUsuario(volver = '/'): Promise<UsuarioSesion> {
  const u = await usuarioActual()
  if (!u) redirect(`/entrar?volver=${encodeURIComponent(rutaSegura(volver))}`)
  return u
}

export async function exigirRol(roles: Rol[], volver = '/'): Promise<UsuarioSesion> {
  const u = await exigirUsuario(volver)
  if (!roles.includes(u.rol)) redirect('/')
  return u
}

/** IP de la petición (detrás del proxy del hosting), para limitar acciones anónimas. */
export async function ipActual(): Promise<string> {
  const h = await headers()
  return h.get('x-forwarded-for')?.split(',')[0]?.trim() || h.get('x-real-ip') || 'local'
}
