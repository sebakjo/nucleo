/** Info fija del estudio, debajo de la grilla. Se prerenderiza en la parte estática de la página. */
export function Estudio() {
  return (
    <section
      aria-labelledby="titulo-estudio"
      className="mt-16 grid gap-8 border-t border-linea pt-10 md:grid-cols-3"
    >
      <div>
        <h2 id="titulo-estudio" className="text-seccion font-semibold">
          Cómo funciona
        </h2>
        <p className="mt-2 text-grafito-2">
          Cada clase tiene 6 reformers y dura entre 50 y 55 minutos. Reservás con un crédito de tu pack o
          pagando la clase suelta.
        </p>
      </div>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-4 md:col-span-2 md:grid-cols-3">
        {[
          ['Cancelación', 'Hasta 12 horas antes recuperás el crédito. Después, se pierde.'],
          ['Lista de espera', 'Si una clase se llena, anotate: si se libera un lugar, es tuyo.'],
          ['Pago de una clase', 'Tu lugar queda guardado 10 minutos mientras pagás.'],
          ['Packs', '4, 8 o 12 clases para usar en 30 días.'],
          ['Niveles', 'Fundamentos, Reformer clásico, Reformer power y Movilidad.'],
          ['Horario', 'Lunes a viernes de 7 a 21:30. Sábados por la mañana.'],
        ].map(([t, d]) => (
          <div key={t}>
            <dt className="text-chico font-semibold">{t}</dt>
            <dd className="mt-0.5 text-chico text-grafito-2">{d}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
