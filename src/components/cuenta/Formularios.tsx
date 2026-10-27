'use client'

import Link from 'next/link'
import { useActionState } from 'react'
import { entrar, registrarme, type EstadoFormulario } from '@/app/acciones/sesion'

function Campo(props: {
  nombre: string
  etiqueta: string
  tipo?: string
  autocompletar: string
  valor?: string
  ayuda?: string
  invalido?: boolean
}) {
  const ayudaId = props.ayuda ? `${props.nombre}-ayuda` : undefined
  return (
    <div>
      <label htmlFor={props.nombre} className="text-chico font-semibold">
        {props.etiqueta}
      </label>
      <input
        id={props.nombre}
        name={props.nombre}
        type={props.tipo ?? 'text'}
        autoComplete={props.autocompletar}
        defaultValue={props.valor}
        required
        aria-invalid={props.invalido || undefined}
        aria-describedby={ayudaId}
        className="mt-1.5 campo"
      />
      {props.ayuda && (
        <p id={ayudaId} className="mt-1 text-leyenda text-grafito-2">
          {props.ayuda}
        </p>
      )}
    </div>
  )
}

function Error({ estado }: { estado: EstadoFormulario }) {
  if (!estado?.error) return null
  return (
    <p role="alert" className="rounded-boton bg-error-tenue px-4 py-3 text-chico text-error">
      {estado.error}
    </p>
  )
}

export function FormularioEntrar({ volver }: { volver: string }) {
  const [estado, accion, enCurso] = useActionState(entrar, null)
  return (
    <form action={accion} className="grid gap-4" noValidate>
      <input type="hidden" name="volver" value={volver} />
      <Campo
        nombre="email"
        etiqueta="Email"
        tipo="email"
        autocompletar="email"
        valor={estado?.campos?.email}
        invalido={!!estado?.error}
      />
      <Campo
        nombre="contrasena"
        etiqueta="Contraseña"
        tipo="password"
        autocompletar="current-password"
        invalido={!!estado?.error}
      />
      <Error estado={estado} />
      <button type="submit" className="boton boton-principal" disabled={enCurso}>
        {enCurso ? 'Entrando…' : 'Entrar'}
      </button>
      <p className="text-chico text-grafito-2">
        ¿No tenés cuenta?{' '}
        <Link
          href={`/registrarme?volver=${encodeURIComponent(volver)}`}
          className="font-medium text-eucalipto hover:underline"
        >
          Creá una
        </Link>
      </p>
    </form>
  )
}

export function FormularioRegistro({ volver }: { volver: string }) {
  const [estado, accion, enCurso] = useActionState(registrarme, null)
  return (
    <form action={accion} className="grid gap-4" noValidate>
      <input type="hidden" name="volver" value={volver} />
      <Campo
        nombre="nombre"
        etiqueta="Nombre y apellido"
        autocompletar="name"
        valor={estado?.campos?.nombre}
      />
      <Campo
        nombre="email"
        etiqueta="Email"
        tipo="email"
        autocompletar="email"
        valor={estado?.campos?.email}
      />
      <Campo
        nombre="contrasena"
        etiqueta="Contraseña"
        tipo="password"
        autocompletar="new-password"
        ayuda="Al menos 8 caracteres."
      />
      <Error estado={estado} />
      <button type="submit" className="boton boton-principal" disabled={enCurso}>
        {enCurso ? 'Creando tu cuenta…' : 'Crear mi cuenta'}
      </button>
      <p className="text-chico text-grafito-2">
        ¿Ya tenés cuenta?{' '}
        <Link
          href={`/entrar?volver=${encodeURIComponent(volver)}`}
          className="font-medium text-eucalipto hover:underline"
        >
          Entrá
        </Link>
      </p>
    </form>
  )
}
