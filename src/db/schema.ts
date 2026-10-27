import { sql } from 'drizzle-orm'
import {
  bigint,
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'

const fecha = () => timestamp({ withTimezone: true, mode: 'date' }).notNull()
const fechaOpcional = () => timestamp({ withTimezone: true, mode: 'date' })
const creadoEn = () => fecha().defaultNow()

// -------------------------------------------------------------------------------------------------
// Better Auth (los nombres de propiedad son los que espera el adaptador de Drizzle)
// -------------------------------------------------------------------------------------------------

export const rol = pgEnum('rol', ['alumno', 'instructor', 'admin'])

export const user = pgTable('usuarios', {
  id: text().primaryKey(),
  name: text('nombre').notNull(),
  email: text().notNull().unique(),
  emailVerified: boolean('email_verificado').notNull().default(false),
  image: text('imagen'),
  role: rol('rol').notNull().default('alumno'),
  createdAt: creadoEn(),
  updatedAt: fecha().defaultNow(),
})

export const session = pgTable(
  'sesiones',
  {
    id: text().primaryKey(),
    expiresAt: fecha(),
    token: text().notNull().unique(),
    createdAt: creadoEn(),
    updatedAt: fecha().defaultNow(),
    ipAddress: text(),
    userAgent: text(),
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
  },
  (t) => [index().on(t.userId)],
)

export const account = pgTable(
  'cuentas',
  {
    id: text().primaryKey(),
    accountId: text().notNull(),
    providerId: text().notNull(),
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    accessToken: text(),
    refreshToken: text(),
    idToken: text(),
    accessTokenExpiresAt: fechaOpcional(),
    refreshTokenExpiresAt: fechaOpcional(),
    scope: text(),
    password: text(),
    createdAt: creadoEn(),
    updatedAt: fecha().defaultNow(),
  },
  (t) => [index().on(t.userId)],
)

export const verification = pgTable('verificaciones', {
  id: text().primaryKey(),
  identifier: text().notNull(),
  value: text().notNull(),
  expiresAt: fecha(),
  createdAt: creadoEn(),
  updatedAt: fecha().defaultNow(),
})

/** Límite de intentos de Better Auth (login, registro), compartido entre instancias. */
export const rateLimit = pgTable('limites_auth', {
  id: text()
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  key: text().notNull().unique(),
  count: integer().notNull(),
  lastRequest: bigint({ mode: 'number' }).notNull(),
})

// -------------------------------------------------------------------------------------------------
// Estudio
// -------------------------------------------------------------------------------------------------

export const instructores = pgTable('instructores', {
  id: uuid().primaryKey().defaultRandom(),
  nombre: text().notNull(),
  bio: text().notNull().default(''),
  usuarioId: text()
    .unique()
    .references(() => user.id, { onDelete: 'set null' }),
  activo: boolean().notNull().default(true),
  creadoEn: creadoEn(),
})

export const tiposClase = pgTable('tipos_clase', {
  id: uuid().primaryKey().defaultRandom(),
  slug: text().notNull().unique(),
  nombre: text().notNull(),
  descripcion: text().notNull(),
  nivel: text().notNull(),
  duracionMin: smallint().notNull().default(55),
})

/** Plantilla semanal: genera una clase por semana (día ISO 1 = lunes, hora en Buenos Aires). */
export const plantillas = pgTable(
  'plantillas',
  {
    id: uuid().primaryKey().defaultRandom(),
    diaSemana: smallint().notNull(),
    hora: text().notNull(),
    duracionMin: smallint().notNull().default(55),
    instructorId: uuid()
      .notNull()
      .references(() => instructores.id),
    tipoClaseId: uuid()
      .notNull()
      .references(() => tiposClase.id),
    cupo: smallint().notNull().default(6),
    activa: boolean().notNull().default(true),
    creadaEn: creadoEn(),
  },
  (t) => [
    check('plantilla_dia', sql`${t.diaSemana} between 1 and 7`),
    check('plantilla_hora', sql`${t.hora} ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'`),
    check('plantilla_cupo', sql`${t.cupo} between 1 and 6`),
  ],
)

export const estadoClase = pgEnum('estado_clase', ['programada', 'cancelada'])

export const clases = pgTable(
  'clases',
  {
    id: uuid().primaryKey().defaultRandom(),
    plantillaId: uuid().references(() => plantillas.id, { onDelete: 'set null' }),
    tipoClaseId: uuid()
      .notNull()
      .references(() => tiposClase.id),
    instructorId: uuid()
      .notNull()
      .references(() => instructores.id),
    iniciaEn: fecha(),
    terminaEn: fecha(),
    /** Horario de la plantilla que la generó. No cambia si se reprograma: así no se genera otra vez. */
    generadaPara: fechaOpcional(),
    cupo: smallint().notNull().default(6),
    estado: estadoClase().notNull().default('programada'),
    /** Clase aislada para la simulación de /caso: no aparece en horarios ni en métricas. */
    sandbox: boolean().notNull().default(false),
    creadaEn: creadoEn(),
  },
  (t) => [
    uniqueIndex('clase_por_plantilla').on(t.plantillaId, t.generadaPara),
    index().on(t.iniciaEn),
    check('clase_cupo', sql`${t.cupo} between 1 and 6`),
  ],
)

// -------------------------------------------------------------------------------------------------
// Reservas y lista de espera
// -------------------------------------------------------------------------------------------------

export const estadoReserva = pgEnum('estado_reserva', [
  'pendiente_pago',
  'confirmada',
  'cancelada',
  'cancelada_tarde',
  'asistio',
  'vencida',
])
export const medioReserva = pgEnum('medio_reserva', ['credito', 'pago'])
export const origenReserva = pgEnum('origen_reserva', ['directa', 'lista_espera', 'simulacion'])

/** Estados que ocupan un reformer (las pendientes, solo mientras no vence la retención). */
export const ESTADOS_ACTIVOS = ['pendiente_pago', 'confirmada', 'asistio'] as const

export const reservas = pgTable(
  'reservas',
  {
    id: uuid().primaryKey().defaultRandom(),
    usuarioId: text()
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    claseId: uuid()
      .notNull()
      .references(() => clases.id, { onDelete: 'cascade' }),
    estado: estadoReserva().notNull(),
    medio: medioReserva().notNull(),
    origen: origenReserva().notNull().default('directa'),
    reformer: smallint().notNull(),
    /** Hasta cuándo se guarda el lugar de una reserva pendiente de pago. */
    retenidaHasta: fechaOpcional(),
    /** Pack del que salió (o al que volvió) el crédito. */
    packId: uuid().references(() => packs.id),
    precioArs: integer(),
    recordatorioEnviadoEn: fechaOpcional(),
    creadaEn: creadoEn(),
    confirmadaEn: fechaOpcional(),
    canceladaEn: fechaOpcional(),
  },
  (t) => [
    // Restricción única (alumno, clase) para reservas activas: una cancelada no impide volver a reservar.
    uniqueIndex('reserva_activa_por_alumno')
      .on(t.usuarioId, t.claseId)
      .where(sql`${t.estado} in ('pendiente_pago', 'confirmada', 'asistio')`),
    // Un reformer no puede estar asignado dos veces en la misma clase.
    uniqueIndex('reformer_activo_por_clase')
      .on(t.claseId, t.reformer)
      .where(sql`${t.estado} in ('pendiente_pago', 'confirmada', 'asistio')`),
    index().on(t.claseId, t.estado),
    index().on(t.usuarioId),
    check('reserva_reformer', sql`${t.reformer} between 1 and 6`),
  ],
)

export const estadoEspera = pgEnum('estado_espera', [
  'esperando',
  'oferta',
  'promovida',
  'vencida',
  'retirada',
])

export const listaEspera = pgTable(
  'lista_espera',
  {
    id: uuid().primaryKey().defaultRandom(),
    usuarioId: text()
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    claseId: uuid()
      .notNull()
      .references(() => clases.id, { onDelete: 'cascade' }),
    posicion: integer().notNull(),
    estado: estadoEspera().notNull().default('esperando'),
    /** Reserva creada al promover (confirmada con crédito, o pendiente con 30 min para pagar). */
    reservaId: uuid().references(() => reservas.id),
    ofertaVence: fechaOpcional(),
    creadaEn: creadoEn(),
  },
  (t) => [
    uniqueIndex('espera_activa_por_alumno')
      .on(t.usuarioId, t.claseId)
      .where(sql`${t.estado} in ('esperando', 'oferta')`),
    uniqueIndex('espera_posicion').on(t.claseId, t.posicion),
  ],
)

// -------------------------------------------------------------------------------------------------
// Packs y créditos
// -------------------------------------------------------------------------------------------------

export const productosPack = pgTable('productos_pack', {
  id: uuid().primaryKey().defaultRandom(),
  nombre: text().notNull(),
  creditos: smallint().notNull(),
  precioArs: integer().notNull(),
  validezDias: smallint().notNull().default(30),
  activo: boolean().notNull().default(true),
  orden: smallint().notNull().default(0),
})

export const estadoPack = pgEnum('estado_pack', ['pendiente_pago', 'activo', 'vencido', 'cancelado'])

export const packs = pgTable(
  'packs',
  {
    id: uuid().primaryKey().defaultRandom(),
    usuarioId: text()
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    /** Null para los créditos generados por una cancelación o un pago tardío. */
    productoId: uuid().references(() => productosPack.id),
    nombre: text().notNull(),
    creditosTotales: smallint().notNull(),
    creditosRestantes: smallint().notNull().default(0),
    estado: estadoPack().notNull(),
    compradoEn: fechaOpcional(),
    venceEn: fechaOpcional(),
    creadoEn: creadoEn(),
  },
  (t) => [
    index().on(t.usuarioId, t.estado),
    check(
      'pack_restantes',
      sql`${t.creditosRestantes} >= 0 and ${t.creditosRestantes} <= ${t.creditosTotales}`,
    ),
  ],
)

export const motivoMovimiento = pgEnum('motivo_movimiento', [
  'compra',
  'reserva',
  'devolucion',
  'credito_por_cancelacion',
  'clase_cancelada',
  'pago_tardio',
  'vencimiento',
  'ajuste',
])

/** Historial auditable: el saldo de un pack es la suma de sus movimientos. */
export const movimientosCredito = pgTable(
  'movimientos_credito',
  {
    id: uuid().primaryKey().defaultRandom(),
    usuarioId: text()
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    packId: uuid()
      .notNull()
      .references(() => packs.id, { onDelete: 'cascade' }),
    reservaId: uuid().references(() => reservas.id, { onDelete: 'set null' }),
    delta: smallint().notNull(),
    motivo: motivoMovimiento().notNull(),
    nota: text(),
    /** Quién hizo el ajuste manual (admin); null si lo hizo el sistema. */
    actorId: text().references(() => user.id, { onDelete: 'set null' }),
    creadoEn: creadoEn(),
  },
  (t) => [index().on(t.usuarioId, t.creadoEn), index().on(t.packId)],
)

// -------------------------------------------------------------------------------------------------
// Pagos
// -------------------------------------------------------------------------------------------------

export const tipoPago = pgEnum('tipo_pago', ['clase', 'pack'])
export const proveedorPago = pgEnum('proveedor_pago', ['mercadopago', 'simulado'])
export const estadoPago = pgEnum('estado_pago', [
  'pendiente',
  'en_proceso',
  'aprobado',
  'rechazado',
  'cancelado',
  'reembolsado',
])

export const pagos = pgTable(
  'pagos',
  {
    /** También es la external_reference que viaja a Mercado Pago. */
    id: uuid().primaryKey().defaultRandom(),
    usuarioId: text()
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    tipo: tipoPago().notNull(),
    reservaId: uuid().references(() => reservas.id, { onDelete: 'set null' }),
    packId: uuid().references(() => packs.id, { onDelete: 'set null' }),
    proveedor: proveedorPago().notNull(),
    preferenciaId: text(),
    urlPago: text(),
    /** Id del pago en el proveedor (payment id de Mercado Pago). */
    idExterno: text(),
    estado: estadoPago().notNull().default('pendiente'),
    detalleEstado: text(),
    montoArs: integer().notNull(),
    moneda: text().notNull().default('ARS'),
    descripcion: text().notNull(),
    datosProveedor: jsonb(),
    creadoEn: creadoEn(),
    actualizadoEn: fecha().defaultNow(),
    aprobadoEn: fechaOpcional(),
  },
  (t) => [index().on(t.usuarioId), index().on(t.estado, t.creadoEn), index().on(t.idExterno)],
)

/** Una fila por notificación recibida: si llega dos veces, la segunda no tiene efecto. */
export const eventosWebhook = pgTable('eventos_webhook', {
  id: uuid().primaryKey().defaultRandom(),
  proveedor: proveedorPago().notNull(),
  clave: text().notNull().unique(),
  tipo: text().notNull(),
  recursoId: text(),
  payload: jsonb(),
  recibidoEn: creadoEn(),
  procesadoEn: fechaOpcional(),
  resultado: text(),
})

/** "API" del proveedor simulado: imita lo que devuelve GET /v1/payments/{id}. */
export const pagosSimulados = pgTable('pagos_simulados', {
  id: text().primaryKey(),
  referenciaExterna: uuid().notNull(),
  estado: text().notNull(),
  detalleEstado: text().notNull(),
  monto: integer().notNull(),
  moneda: text().notNull().default('ARS'),
  creadoEn: creadoEn(),
})

// -------------------------------------------------------------------------------------------------
// Emails, ajustes y límites
// -------------------------------------------------------------------------------------------------

export const estadoEmail = pgEnum('estado_email', ['pendiente', 'enviado', 'registrado', 'fallido'])

/** Outbox: se escribe en la misma transacción que el cambio y se despacha después del commit. */
export const emails = pgTable(
  'emails',
  {
    id: uuid().primaryKey().defaultRandom(),
    usuarioId: text().references(() => user.id, { onDelete: 'set null' }),
    para: text().notNull(),
    plantilla: text().notNull(),
    datos: jsonb().notNull(),
    asunto: text(),
    estado: estadoEmail().notNull().default('pendiente'),
    intentos: smallint().notNull().default(0),
    error: text(),
    /** Evita duplicados, por ejemplo un solo recordatorio por reserva. */
    claveUnica: text().unique(),
    creadoEn: creadoEn(),
    enviadoEn: fechaOpcional(),
  },
  (t) => [index().on(t.estado, t.creadoEn)],
)

export const ajustes = pgTable('ajustes', {
  clave: text().primaryKey(),
  valor: jsonb().notNull(),
  actualizadoEn: fecha().defaultNow(),
})

/** Rate limit de ventana fija para reservas, pagos y la simulación de /caso. */
export const limites = pgTable('limites', {
  clave: text().primaryKey(),
  ventanaInicio: fecha(),
  conteo: integer().notNull(),
})

export type Usuario = typeof user.$inferSelect
export type Rol = (typeof rol.enumValues)[number]
export type Clase = typeof clases.$inferSelect
export type Reserva = typeof reservas.$inferSelect
export type EstadoReserva = (typeof estadoReserva.enumValues)[number]
export type Pack = typeof packs.$inferSelect
export type Pago = typeof pagos.$inferSelect
export type EstadoPago = (typeof estadoPago.enumValues)[number]
export type EntradaEspera = typeof listaEspera.$inferSelect
