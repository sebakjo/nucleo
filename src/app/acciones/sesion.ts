'use server'

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { contrasenaDemo, CUENTAS_DEMO, modoDemo } from '@/lib/config'
import { rutaSegura } from '@/lib/sesion'

export type EstadoFormulario = { error?: string; campos?: Record<string, string> } | null

const Entrar = z.object({
  email: z.string().trim().toLowerCase().email(),
  contrasena: z.string().min(1).max(128),
  volver: z.string().optional(),
})

export async function entrar(_: EstadoFormulario, form: FormData): Promise<EstadoFormulario> {
  const datos = Entrar.safeParse(Object.fromEntries(form))
  if (!datos.success) {
    return { error: 'Escribí tu email y tu contraseña.', campos: { email: String(form.get('email') ?? '') } }
  }
  try {
    await auth.api.signInEmail({
      body: { email: datos.data.email, password: datos.data.contrasena },
      headers: await headers(),
    })
  } catch {
    return {
      error: 'El email o la contraseña no coinciden. Revisalos y probá de nuevo.',
      campos: { email: datos.data.email },
    }
  }
  redirect(rutaSegura(datos.data.volver))
}

const Registro = z.object({
  nombre: z.string().trim().min(2).max(80),
  email: z.string().trim().toLowerCase().email().max(160),
  contrasena: z.string().min(8).max(128),
  volver: z.string().optional(),
})

export async function registrarme(_: EstadoFormulario, form: FormData): Promise<EstadoFormulario> {
  const datos = Registro.safeParse(Object.fromEntries(form))
  const campos = { nombre: String(form.get('nombre') ?? ''), email: String(form.get('email') ?? '') }
  if (!datos.success) {
    const problema = datos.error.issues[0]?.path[0]
    const mensaje =
      problema === 'contrasena'
        ? 'La contraseña tiene que tener al menos 8 caracteres.'
        : problema === 'email'
          ? 'Revisá el email: no parece válido.'
          : 'Escribí tu nombre (al menos 2 letras).'
    return { error: mensaje, campos }
  }
  try {
    await auth.api.signUpEmail({
      body: { name: datos.data.nombre, email: datos.data.email, password: datos.data.contrasena },
      headers: await headers(),
    })
  } catch {
    return { error: 'Ya existe una cuenta con ese email. Entrá con tu contraseña.', campos }
  }
  redirect(rutaSegura(datos.data.volver))
}

/** Botones "Entrar como … demo" (alumno, instructor, admin). Solo con DEMO_MODE=1. */
export async function entrarDemo(form: FormData) {
  const rol = form.get('cuenta')
  const cuenta = rol === 'admin' || rol === 'instructor' ? CUENTAS_DEMO[rol] : CUENTAS_DEMO.alumno
  const contrasena = contrasenaDemo()
  if (!modoDemo() || !contrasena) redirect('/entrar')
  await auth.api.signInEmail({
    body: { email: cuenta.email, password: contrasena },
    headers: await headers(),
  })
  const volver = String(form.get('volver') ?? '')
  if (cuenta === CUENTAS_DEMO.admin) redirect(rutaSegura(volver.startsWith('/admin') ? volver : '/admin'))
  if (cuenta === CUENTAS_DEMO.instructor) redirect('/instructor')
  redirect(rutaSegura(volver))
}

export async function salir() {
  await auth.api.signOut({ headers: await headers() })
  redirect('/')
}
