import { urlApp } from '@/lib/config'
import { precio } from '@/lib/dinero'
import { diaSemana, diaYMes, fechaLarga, hora } from '@/lib/tiempo'
import type { DatosPorPlantilla, NombrePlantilla } from './tipos'

/**
 * El contenido de cada mensaje, independiente del canal. La plantilla de React Email y la vista
 * previa de WhatsApp se arman con esto, así los dos dicen exactamente lo mismo.
 */
export type Contenido = {
  asunto: string
  previa: string
  titulo: string
  parrafos: string[]
  detalle: [string, string][]
  accion?: { texto: string; url: string }
}

const primerNombre = (n: string) => n.split(' ')[0] ?? n
const cuando = (iso: string) => {
  const d = new Date(iso)
  return `${diaSemana(d)} ${hora(d)}`
}
const creditos = (n: number) => (n === 1 ? 'Te queda 1 crédito' : `Te quedan ${n} créditos`)

type Constructores = { [K in NombrePlantilla]: (d: DatosPorPlantilla[K]) => Contenido }

const CONSTRUCTORES: Constructores = {
  reserva_confirmada: (d) => {
    const inicio = new Date(d.iniciaEn)
    return {
      asunto: `Reservaste el ${cuando(d.iniciaEn)} con ${primerNombre(d.instructor)}`,
      previa: `Reformer ${d.reformer} · ${fechaLarga(inicio)}`,
      titulo: `Reservaste el ${cuando(d.iniciaEn)} con ${primerNombre(d.instructor)}`,
      parrafos: [
        `Hola, ${primerNombre(d.nombre)}. Tu lugar está confirmado: te esperamos en el reformer ${d.reformer}.`,
        d.pagada
          ? 'Pagaste la clase suelta. Si cancelás a tiempo, te damos un crédito para otra clase.'
          : d.creditosRestantes !== null
            ? `Usaste un crédito. ${creditos(d.creditosRestantes)}.`
            : 'Usaste un crédito.',
        `Podés cancelar sin costo hasta el ${fechaLarga(new Date(d.limiteCancelacion))} a las ${hora(new Date(d.limiteCancelacion))}. Después, el crédito se pierde.`,
      ],
      detalle: [
        ['Clase', d.clase],
        ['Cuándo', `${fechaLarga(inicio)}, ${hora(inicio)}`],
        ['Con', d.instructor],
        ['Reformer', String(d.reformer)],
      ],
      accion: { texto: 'Ver mis reservas', url: `${urlApp()}/mis-reservas` },
    }
  },

  reserva_cancelada: (d) => ({
    asunto: `Cancelaste tu clase del ${diaSemana(new Date(d.iniciaEn))}`,
    previa: d.creditoDevuelto ? 'Te devolvimos el crédito' : 'Cancelaste con menos de 12 horas',
    titulo: `Cancelaste tu clase del ${cuando(d.iniciaEn)}`,
    parrafos: [
      `Hola, ${primerNombre(d.nombre)}. Cancelaste ${d.clase} con ${primerNombre(d.instructor)}.`,
      d.creditoDevuelto
        ? 'Como cancelaste con más de 12 horas de anticipación, tenés el crédito disponible para otra clase.'
        : 'Cancelaste con menos de 12 horas de anticipación, así que el crédito no se devuelve. Liberaste el lugar para otra persona.',
    ],
    detalle: [
      ['Clase', d.clase],
      ['Cuándo', `${fechaLarga(new Date(d.iniciaEn))}, ${hora(new Date(d.iniciaEn))}`],
    ],
    accion: { texto: 'Elegir otro horario', url: urlApp() },
  }),

  recordatorio: (d) => ({
    asunto: `Mañana a las ${hora(new Date(d.iniciaEn))}: ${d.clase}`,
    previa: `Reformer ${d.reformer} con ${primerNombre(d.instructor)}`,
    titulo: `Mañana a las ${hora(new Date(d.iniciaEn))} tenés ${d.clase}`,
    parrafos: [
      `Hola, ${primerNombre(d.nombre)}. Te esperamos ${fechaLarga(new Date(d.iniciaEn))} con ${primerNombre(d.instructor)}, en el reformer ${d.reformer}.`,
      'Llegá 10 minutos antes y traé medias antideslizantes.',
      `Si no podés venir, cancelá antes de las ${hora(new Date(d.limiteCancelacion))} del ${fechaLarga(new Date(d.limiteCancelacion))} y recuperás el crédito.`,
    ],
    detalle: [
      ['Clase', d.clase],
      ['Cuándo', `${fechaLarga(new Date(d.iniciaEn))}, ${hora(new Date(d.iniciaEn))}`],
      ['Reformer', String(d.reformer)],
    ],
    accion: { texto: 'Ver o cancelar mi reserva', url: `${urlApp()}/mis-reservas` },
  }),

  espera_promovida: (d) => ({
    asunto: `Se liberó un lugar: reservaste el ${cuando(d.iniciaEn)}`,
    previa: `Reformer ${d.reformer} · ${creditos(d.creditosRestantes)}`,
    titulo: `Se liberó un lugar: reservaste el ${cuando(d.iniciaEn)}`,
    parrafos: [
      `Hola, ${primerNombre(d.nombre)}. Estabas en el primer puesto de la lista de espera de ${d.clase} y se liberó un reformer.`,
      `Usamos uno de tus créditos para reservarte el reformer ${d.reformer}. ${creditos(d.creditosRestantes)}.`,
      'Si al final no podés venir, cancelá desde Mis reservas con más de 12 horas de anticipación y recuperás el crédito.',
    ],
    detalle: [
      ['Clase', d.clase],
      ['Cuándo', `${fechaLarga(new Date(d.iniciaEn))}, ${hora(new Date(d.iniciaEn))}`],
      ['Con', d.instructor],
    ],
    accion: { texto: 'Ver mis reservas', url: `${urlApp()}/mis-reservas` },
  }),

  espera_oferta: (d) => ({
    asunto: `Se liberó un lugar el ${cuando(d.iniciaEn)}: tenés 30 minutos`,
    previa: `Te lo guardamos hasta las ${hora(new Date(d.venceEn))}`,
    titulo: `Se liberó un lugar el ${cuando(d.iniciaEn)}`,
    parrafos: [
      `Hola, ${primerNombre(d.nombre)}. Estabas en el primer puesto de la lista de espera de ${d.clase} con ${primerNombre(d.instructor)}.`,
      `Te guardamos el lugar hasta las ${hora(new Date(d.venceEn))}. Pagá la clase (${precio(d.precioArs)}) o usá un crédito para confirmarlo; si no, pasa a la siguiente persona.`,
    ],
    detalle: [
      ['Clase', d.clase],
      ['Cuándo', `${fechaLarga(new Date(d.iniciaEn))}, ${hora(new Date(d.iniciaEn))}`],
      ['Guardado hasta', hora(new Date(d.venceEn))],
    ],
    accion: { texto: 'Confirmar mi lugar', url: `${urlApp()}/clase/${d.claseId}` },
  }),

  pack_comprado: (d) => ({
    asunto: `Compraste el ${d.pack.toLowerCase()}`,
    previa: `${d.creditos} créditos hasta el ${diaYMes(new Date(d.venceEn))}`,
    titulo: `Compraste el ${d.pack.toLowerCase()}`,
    parrafos: [
      `Hola, ${primerNombre(d.nombre)}. Tenés ${d.creditos} créditos para usar hasta el ${diaYMes(new Date(d.venceEn))}.`,
      'Cada crédito es una clase. Elegí tus horarios cuando quieras.',
    ],
    detalle: [
      ['Pack', d.pack],
      ['Créditos', String(d.creditos)],
      ['Vencen', diaYMes(new Date(d.venceEn))],
    ],
    accion: { texto: 'Reservar una clase', url: urlApp() },
  }),

  pago_tardio: (d) => ({
    asunto: 'Tu pago se acreditó tarde: te dimos un crédito',
    previa: `Válido hasta el ${diaYMes(new Date(d.venceEn))}`,
    titulo: 'Tu pago se acreditó, pero el lugar ya no estaba',
    parrafos: [
      `Hola, ${primerNombre(d.nombre)}. El pago de ${d.clase} del ${cuando(d.iniciaEn)} llegó después de que venció la reserva y la clase se llenó.`,
      `No perdiste nada: te dimos un crédito para cualquier clase hasta el ${diaYMes(new Date(d.venceEn))}.`,
    ],
    detalle: [
      ['Clase', d.clase],
      ['Crédito válido hasta', diaYMes(new Date(d.venceEn))],
    ],
    accion: { texto: 'Usar mi crédito', url: urlApp() },
  }),

  clase_cancelada: (d) => ({
    asunto: `Cancelamos la clase del ${cuando(d.iniciaEn)}`,
    previa: d.creditoDevuelto ? 'Te devolvimos el crédito' : 'Tu reserva quedó sin efecto',
    titulo: `Cancelamos la clase del ${cuando(d.iniciaEn)}`,
    parrafos: [
      `Hola, ${primerNombre(d.nombre)}. Tuvimos que cancelar ${d.clase} con ${primerNombre(d.instructor)}.`,
      d.creditoDevuelto
        ? 'Tenés el crédito disponible para otra clase.'
        : 'Tu reserva pendiente quedó sin efecto y no se cobró nada.',
    ],
    detalle: [
      ['Clase', d.clase],
      ['Cuándo', `${fechaLarga(new Date(d.iniciaEn))}, ${hora(new Date(d.iniciaEn))}`],
    ],
    accion: { texto: 'Elegir otro horario', url: urlApp() },
  }),
}

export function contenidoDe<K extends NombrePlantilla>(plantilla: K, datos: DatosPorPlantilla[K]): Contenido {
  return CONSTRUCTORES[plantilla](datos)
}

/** La misma plantilla, como mensaje de WhatsApp (negritas con asteriscos, sin HTML). */
export function comoWhatsApp(c: Contenido): string {
  const partes = [`*${c.titulo}*`, ...c.parrafos]
  if (c.detalle.length) partes.push(c.detalle.map(([k, v]) => `${k}: *${v}*`).join('\n'))
  if (c.accion) partes.push(`${c.accion.texto}: ${c.accion.url}`)
  return partes.join('\n\n')
}
