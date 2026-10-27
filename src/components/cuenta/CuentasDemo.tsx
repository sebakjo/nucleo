import { entrarDemo } from '@/app/acciones/sesion'

/** Para quien prueba la demo: entra sin registrarse, con datos ya cargados. */
export function CuentasDemo({ volver }: { volver: string }) {
  return (
    <section aria-labelledby="titulo-demo" className="rounded-bloque border border-linea bg-superficie p-6">
      <h2 id="titulo-demo" className="text-seccion font-semibold">
        Probá la demo sin registrarte
      </h2>
      <p className="mt-1 text-chico text-grafito-2">
        Las cuentas demo ya tienen historia: créditos, reservas, una lista de espera y pagos.
      </p>
      <div className="mt-5 grid gap-3">
        <form action={entrarDemo}>
          <input type="hidden" name="cuenta" value="alumno" />
          <input type="hidden" name="volver" value={volver} />
          <button
            type="submit"
            className="boton w-full flex-col items-start gap-0.5 boton-secundario py-2.5 text-left"
          >
            <span>Entrar como alumno demo</span>
            <span className="text-chico font-normal text-grafito-2">Sofía, con créditos y reservas</span>
          </button>
        </form>
        <form action={entrarDemo}>
          <input type="hidden" name="cuenta" value="instructor" />
          <input type="hidden" name="volver" value={volver} />
          <button
            type="submit"
            className="boton w-full flex-col items-start gap-0.5 boton-secundario py-2.5 text-left"
          >
            <span>Entrar como instructor demo</span>
            <span className="text-chico font-normal text-grafito-2">Lucía, sus clases y asistencia</span>
          </button>
        </form>
        <form action={entrarDemo}>
          <input type="hidden" name="cuenta" value="admin" />
          <input type="hidden" name="volver" value={volver} />
          <button
            type="submit"
            className="boton w-full flex-col items-start gap-0.5 boton-secundario py-2.5 text-left"
          >
            <span>Entrar como admin demo</span>
            <span className="text-chico font-normal text-grafito-2">Panel del estudio</span>
          </button>
        </form>
      </div>
    </section>
  )
}
