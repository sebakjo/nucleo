'use client'

import { useActionState, type ReactNode } from 'react'
import {
  ajustarCreditosDeAlumno,
  crearInstructor,
  crearPlantilla,
  guardarPrecios,
  type EstadoPanel,
} from '@/app/acciones/admin'
import { precio } from '@/lib/dinero'

function Resultado({ estado }: { estado: EstadoPanel }) {
  if (!estado) return null
  return (
    <p
      role={estado.ok ? 'status' : 'alert'}
      className={`rounded-boton px-3 py-2 text-chico ${
        estado.ok ? 'bg-eucalipto-tenue text-grafito' : 'bg-error-tenue text-error'
      }`}
    >
      {estado.mensaje}
    </p>
  )
}

function Campo({
  etiqueta,
  id,
  children,
  ayuda,
}: {
  etiqueta: string
  id: string
  children: ReactNode
  ayuda?: string
}) {
  return (
    <div className="min-w-0">
      <label htmlFor={id} className="text-chico font-semibold">
        {etiqueta}
      </label>
      <div className="mt-1.5">{children}</div>
      {ayuda && <p className="mt-1 text-leyenda text-grafito-2">{ayuda}</p>}
    </div>
  )
}

/** De 06:00 a 22:00 cada 15 minutos, en formato de 24 horas. */
const HORAS = Array.from({ length: 65 }, (_, i) => {
  const m = 6 * 60 + i * 15
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
})

const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']

type Opcion = { id: string; nombre: string; duracionMin?: number }

export function FormularioPlantilla({ tipos, instructores }: { tipos: Opcion[]; instructores: Opcion[] }) {
  const [estado, accion, enCurso] = useActionState(crearPlantilla, null)
  return (
    <form action={accion} className="grid gap-4 rounded-bloque border border-linea bg-superficie p-5">
      <h2 className="text-subtitulo font-semibold">Nueva plantilla</h2>
      <div className="grid grid-cols-2 gap-3">
        <Campo etiqueta="Día" id="diaSemana">
          <select id="diaSemana" name="diaSemana" className="campo" defaultValue="4">
            {DIAS.map((d, i) => (
              <option key={d} value={i + 1}>
                {d}
              </option>
            ))}
          </select>
        </Campo>
        <Campo etiqueta="Hora" id="hora">
          <select id="hora" name="hora" className="campo tabular" defaultValue="21:30">
            {HORAS.map((h) => (
              <option key={h}>{h}</option>
            ))}
          </select>
        </Campo>
      </div>
      <Campo etiqueta="Clase" id="tipoClaseId">
        <select id="tipoClaseId" name="tipoClaseId" className="campo" required>
          {tipos.map((t) => (
            <option key={t.id} value={t.id}>
              {t.nombre}
            </option>
          ))}
        </select>
      </Campo>
      <Campo etiqueta="Instructor" id="instructorId">
        <select id="instructorId" name="instructorId" className="campo" required>
          {instructores.map((i) => (
            <option key={i.id} value={i.id}>
              {i.nombre}
            </option>
          ))}
        </select>
      </Campo>
      <div className="grid grid-cols-2 gap-3">
        <Campo etiqueta="Lugares" id="cupo" ayuda="Hasta 6 reformers.">
          <input
            id="cupo"
            name="cupo"
            type="number"
            min={1}
            max={6}
            defaultValue={6}
            required
            className="campo tabular"
          />
        </Campo>
        <Campo etiqueta="Duración (min)" id="duracionMin">
          <input
            id="duracionMin"
            name="duracionMin"
            type="number"
            min={30}
            max={90}
            step={5}
            defaultValue={55}
            required
            className="campo tabular"
          />
        </Campo>
      </div>
      <Resultado estado={estado} />
      <button type="submit" className="boton boton-principal" disabled={enCurso}>
        {enCurso ? 'Creando…' : 'Crear plantilla y generar clases'}
      </button>
      <p className="text-leyenda text-grafito-2">Se generan las clases de las próximas 3 semanas.</p>
    </form>
  )
}

export function FormularioInstructor() {
  const [estado, accion, enCurso] = useActionState(crearInstructor, null)
  return (
    <form action={accion} className="grid gap-4 rounded-bloque border border-linea bg-superficie p-5">
      <h2 className="text-subtitulo font-semibold">Sumar instructor</h2>
      <Campo etiqueta="Nombre y apellido" id="nombre">
        <input
          id="nombre"
          name="nombre"
          required
          minLength={3}
          maxLength={60}
          autoComplete="off"
          className="campo"
        />
      </Campo>
      <Campo etiqueta="Presentación" id="bio" ayuda="Opcional. Se muestra en la reserva.">
        <textarea id="bio" name="bio" maxLength={200} rows={3} className="campo py-2" />
      </Campo>
      <Resultado estado={estado} />
      <button type="submit" className="boton boton-principal" disabled={enCurso}>
        {enCurso ? 'Guardando…' : 'Sumar instructor'}
      </button>
    </form>
  )
}

export function FormularioAjuste({ usuarioId }: { usuarioId: string }) {
  const [estado, accion, enCurso] = useActionState(ajustarCreditosDeAlumno, null)
  return (
    <form action={accion} className="grid gap-3">
      <input type="hidden" name="usuarioId" value={usuarioId} />
      <div className="grid grid-cols-[96px_1fr] gap-3">
        <Campo etiqueta="Créditos" id="delta" ayuda="−3 para restar">
          <input
            id="delta"
            name="delta"
            type="number"
            min={-20}
            max={20}
            required
            defaultValue={1}
            className="campo tabular"
          />
        </Campo>
        <Campo etiqueta="Motivo" id="nota">
          <input
            id="nota"
            name="nota"
            required
            minLength={3}
            maxLength={140}
            placeholder="Compensación por clase reprogramada"
            className="campo"
          />
        </Campo>
      </div>
      <Resultado estado={estado} />
      <button type="submit" className="boton boton-secundario" disabled={enCurso}>
        {enCurso ? 'Guardando…' : 'Ajustar créditos'}
      </button>
    </form>
  )
}

type Producto = {
  id: string
  nombre: string
  creditos: number
  precioArs: number
  validezDias: number
  activo: boolean
}

export function FormularioPrecios({
  precioClase,
  productos,
}: {
  precioClase: number
  productos: Producto[]
}) {
  const [estado, accion, enCurso] = useActionState(guardarPrecios, null)
  return (
    <form action={accion} className="grid gap-6">
      <div className="max-w-xs">
        <Campo etiqueta="Clase suelta" id="precioClase" ayuda="Se cobra al reservar sin créditos.">
          <div className="relative">
            <span className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-grafito-2">
              $
            </span>
            <input
              id="precioClase"
              name="precioClase"
              type="number"
              min={1000}
              max={2000000}
              step={500}
              defaultValue={precioClase}
              required
              className="campo pl-7 tabular"
            />
          </div>
        </Campo>
      </div>
      <fieldset className="grid gap-3">
        <legend className="text-subtitulo font-semibold">Packs</legend>
        <p className="-mt-1 text-chico text-grafito-2">
          Los créditos de un pack vencen a los 30 días de la compra.
        </p>
        {productos.map((p) => (
          <div
            key={p.id}
            className="grid grid-cols-[1fr_auto] items-end gap-x-4 gap-y-3 rounded-bloque border border-linea bg-superficie p-4 sm:grid-cols-[1fr_180px_auto]"
          >
            <div>
              <p className="font-semibold">{p.nombre}</p>
              <p className="text-chico text-grafito-2 tabular">
                {p.creditos} clases · {precio(Math.round(p.precioArs / p.creditos))} cada una
              </p>
            </div>
            <div className="col-span-2 row-start-2 sm:col-span-1 sm:row-start-auto">
              <label htmlFor={`precio-${p.id}`} className="sr-only">
                Precio del {p.nombre}
              </label>
              <div className="relative">
                <span className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-grafito-2">
                  $
                </span>
                <input
                  id={`precio-${p.id}`}
                  name={`precio-${p.id}`}
                  type="number"
                  min={1000}
                  max={2000000}
                  step={500}
                  defaultValue={p.precioArs}
                  required
                  className="campo pl-7 tabular"
                />
              </div>
            </div>
            <label className="flex min-h-11 items-center gap-2 text-chico font-medium">
              <input
                type="checkbox"
                name={`activo-${p.id}`}
                defaultChecked={p.activo}
                className="h-4 w-4 accent-[var(--eucalipto)]"
              />
              A la venta
            </label>
          </div>
        ))}
      </fieldset>
      <Resultado estado={estado} />
      <div>
        <button type="submit" className="boton boton-principal" disabled={enCurso}>
          {enCurso ? 'Guardando…' : 'Guardar precios'}
        </button>
      </div>
    </form>
  )
}
