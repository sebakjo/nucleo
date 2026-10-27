# Núcleo — plan de implementación

**Objetivo:** demo de portafolio "de prototipo a producción". Un estudio ficticio de pilates reformer en Buenos Aires (Núcleo, 6 reformers por clase) con dos versiones: el prototipo típico hecho con IA (`/antes`) y la app de producción (base de datos, usuarios, pagos verificados, concurrencia segura), más la página `/caso` que las compara con una simulación en vivo de sobreventa.

**Arquitectura:** una sola app Next.js (App Router) que habla con PostgreSQL vía Drizzle. Toda regla de negocio vive en `src/lib/dominio/*` como funciones que reciben una transacción: las acciones del servidor, los route handlers, las tareas programadas y los tests llaman a esas mismas funciones. Los efectos externos (emails) se escriben en una tabla outbox dentro de la misma transacción y se despachan después del commit, así un rollback nunca manda un email.

**Stack:** Next.js 16 · React 19 · TypeScript estricto · Tailwind CSS 4 · PostgreSQL 17 + Drizzle ORM (migraciones versionadas con drizzle-kit) · Better Auth (email y contraseña, roles) · Radix UI re-estilado · Mercado Pago Checkout Pro (API REST con `fetch`) · React Email + Nodemailer (Mailpit en local) · Vitest · Playwright · Docker Compose · GitHub Actions.

## Restricciones globales (del brief)

- Marca ficticia "Núcleo". Aviso discreto y permanente: "Proyecto de demostración: los pagos funcionan en modo de prueba".
- Sin datos de contacto personales dentro de la app.
- El precio lo define el servidor. Montos en ARS como enteros.
- Todo se guarda en UTC y se muestra en `America/Argentina/Buenos_Aires`, sin importar el navegador.
- Sin sobreventa: `SELECT ... FOR UPDATE` sobre la clase, contar activas (confirmadas + pendientes no vencidas) y recién ahí insertar. Índice único parcial (alumno, clase) para reservas activas.
- Créditos: se descuentan y devuelven en la misma transacción que la reserva o la cancelación; cada movimiento queda en `movimientos_credito`.
- Regla de cancelación (12 h) en un solo archivo: `src/lib/dominio/reglas.ts`, con tests.
- Copy en español rioplatense con voseo, mayúscula solo al inicio de la frase, sin flechas decorativas.
- Si falta una credencial: modo simulado documentado en el README. Nunca frenar.
- Imprescindible terminado y pulido antes de tocar lo opcional.

## Estructura

```
/docker-compose.yml        db (postgres 17) · mailpit · app (build de producción + migrar + seed) · cron
/Dockerfile                imagen standalone de Next.js
/drizzle/                  migraciones SQL versionadas
/public/antes/index.html   prototipo "antes" (un solo archivo con JS, 7 PROBLEMA marcados)
/src/app/
  (sitio)/page.tsx                   horarios (grilla semanal)
  (sitio)/clase/[id]/page.tsx        paso 2 y 3: confirmar y pagar o usar crédito
  (sitio)/packs/page.tsx             compra de packs
  (sitio)/pago/[id]/page.tsx         retorno del pago (aprobado, pendiente, rechazado)
  (sitio)/pago-simulado/[id]/page.tsx checkout simulado (solo test y local sin credenciales)
  (sitio)/mis-reservas/page.tsx      próximas, pasadas, créditos y vencimientos
  (sitio)/entrar, (sitio)/registrarme
  (sitio)/instructor/page.tsx        clases propias con lista y asistencia
  admin/…                            agenda, plantillas, instructores, alumnos, pagos, métricas, precios, mensajes
  (sitio)/caso/page.tsx              comparación, tabla, simulación y métricas
  api/auth/[...all]                  Better Auth
  api/disponibilidad                 lugares por clase (polling cada 10 s)
  api/webhooks/mercadopago           firma x-signature, consulta a la API, idempotente
  api/cron/[tarea]                   liberar, recordatorios, vencer-packs, lista-de-espera, emails, generar-clases
  api/caso/simulacion                20 reservas simultáneas contra la clase aislada (NDJSON en vivo)
/src/db/                   schema.ts · index.ts · seed.ts
/src/lib/dominio/          reglas · cupos · reservas · creditos · lista-espera · pagos · precios · tareas
/src/lib/consultas/        lecturas para las páginas (horarios, alumno, panel y métricas)
/src/lib/caso/             el código de reserva del prototipo y la simulación de /caso
/src/lib/pagos/            mercadopago · simulado · firma
/src/lib/email/            plantillas React Email · outbox · transporte (SMTP / Resend / log)
/src/lib/                  tiempo (zona horaria) · auth · sesion (roles) · limite (rate limit en Postgres)
/tests/                    Vitest: reglas puras + integración contra Postgres real (concurrencia, webhook)
/e2e/                      Playwright
/scripts/                  cron-local · capturas · lighthouse · metricas
/docs/                     screenshots · lighthouse · caso-de-estudio · guion-video · deploy
```

## Modelo de datos

| Tabla                                        | Clave                                                                                                                                                                                                                     |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `user`, `session`, `account`, `verification` | Better Auth; `user.role` = alumno · instructor · admin                                                                                                                                                                    |
| `instructores`                               | nombre, bio, iniciales; `user_id` opcional (rol instructor)                                                                                                                                                               |
| `tipos_clase`                                | nombre, descripción, duración, nivel                                                                                                                                                                                      |
| `plantillas`                                 | día ISO, hora local, duración, instructor, tipo, cupo, activa                                                                                                                                                             |
| `clases`                                     | instancia: `inicia_en`/`termina_en` (timestamptz), cupo, estado, `plantilla_id`, `sandbox` (clase aislada de `/caso`); único (plantilla, inicio)                                                                          |
| `reservas`                                   | estado: pendiente_pago · confirmada · cancelada · cancelada_tarde · asistio · vencida; `reformer` 1–6; `retenida_hasta`; medio: credito · pago; índices únicos parciales (alumno, clase) y (clase, reformer) para activas |
| `lista_espera`                               | posición, estado: esperando · oferta · promovida · vencida · retirada; `oferta_vence`                                                                                                                                     |
| `productos_pack`                             | 4 · 8 · 12 clases, precio, validez 30 días (editables)                                                                                                                                                                    |
| `packs`                                      | comprados: créditos totales y restantes, vencimiento, estado                                                                                                                                                              |
| `movimientos_credito`                        | delta, motivo, pack, reserva — auditable                                                                                                                                                                                  |
| `pagos`                                      | proveedor, id externo, preferencia, estado, monto, referencia, tipo (clase · pack)                                                                                                                                        |
| `eventos_webhook`                            | id de notificación único → idempotencia                                                                                                                                                                                   |
| `emails`                                     | outbox: plantilla, datos, estado, intentos                                                                                                                                                                                |
| `ajustes`                                    | precio de la clase suelta                                                                                                                                                                                                 |
| `limites`                                    | ventana fija por clave (rate limit compartido entre instancias)                                                                                                                                                           |

## Fases

1. **Prototipo `/antes`** — un HTML con grilla, reserva, "pago" y cancelación; estilo genérico a propósito; 7 `// PROBLEMA:`.
2. **Base de datos, seed y auth** — Docker Compose, schema, migración inicial, seed (4 instructores, 4 tipos, plantillas, 3 semanas, 30 alumnos con historia), Better Auth con roles y botones demo.
3. **Horarios y reserva concurrente** — grilla semanal con carriles, polling, paso 2; `reservar()` con `FOR UPDATE`; test de 20 reservas simultáneas contra Postgres real.
4. **Pagos, packs y créditos** — retención de 10 minutos, Mercado Pago (preferencia, retorno, webhook con firma, consulta a la API, idempotencia), proveedor simulado, packs, movimientos de crédito, tests del webhook.
5. **Cancelaciones, lista de espera, emails y cron** — regla de 12 h, promoción automática o con oferta de 30 min, plantillas React Email + vista WhatsApp, outbox, endpoints de cron protegidos y script local.
6. **Panel de administración y métricas** — agenda con atajos, plantillas, instructores, alumnos, pagos, precios, métricas, modo oscuro; vista de instructor.
7. **`/caso`** — slider antes/después, tabla de problemas, simulación de 20 reservas en vivo (con límite de uso y bloqueo), métricas reales leídas de `docs/metricas/*.json`.
8. **Calidad y entregables** — Playwright e2e, Lighthouse móvil ≥ 90, a11y, responsive, CI, README, capturas revisadas, caso de estudio, guion, deploy.

Cada fase cierra con tests en verde, capturas revisadas y un commit.

## Decisiones

- **Better Auth** sobre Auth.js: email y contraseña es un caso de primera clase (Auth.js desaconseja el proveedor de credenciales y no guarda sesiones en base con él), tiene adaptador oficial de Drizzle, sesiones en la base revocables, hash con scrypt y campos adicionales tipados para el rol.
- **`fetch` contra la API de Mercado Pago** en lugar del SDK: dos endpoints (`/checkout/preferences` y `/v1/payments/{id}`), respuestas validadas con zod y fáciles de simular en tests.
- **La retención de 10 minutos no depende del cron**: una reserva pendiente cuenta como ocupada solo mientras `retenida_hasta > now()`. El cron la marca vencida y promueve la lista de espera, pero la disponibilidad ya es correcta aunque el cron se atrase.
- **Lista de espera con prioridad**: cuando se libera un lugar, se asigna a la lista antes de aceptar reservas nuevas; si el primero no tiene créditos, el lugar le queda retenido 30 minutos para pagar.
- **Rate limit en Postgres** (ventana fija con upsert) para que valga igual con varias instancias serverless.

## Checklist final contra el brief

Revisado el 27 de octubre de 2026, con el build de producción, 59 tests de Vitest y 7 flujos de
Playwright en verde.

**Imprescindible**

- [x] `DESIGN.md` antes del código, con las decisiones tomadas durante la construcción al final.
- [x] Marca Núcleo, 6 lugares por clase y el aviso «Proyecto de demostración: los pagos funcionan en modo de prueba» en todas las pantallas.
- [x] `/antes`: un solo HTML con los 7 `// PROBLEMA:`.
- [x] Horarios semanales con disponibilidad en tiempo real (se actualiza cada 10 s sin recargar).
- [x] Reserva en 3 pasos: elegí la clase, confirmá, pagá o tu lugar.
- [x] Packs de 4, 8 y 12 clases, válidos 30 días, con Mercado Pago Checkout Pro.
- [x] La reserva pendiente de pago retiene el lugar 10 minutos (sin depender del cron).
- [x] Mis reservas con la regla de cancelación de 12 horas.
- [x] Lista de espera con promoción automática (con crédito queda reservada; sin crédito, 30 minutos para pagar).
- [x] Recordatorio por email 24 horas antes y vista previa del mensaje de WhatsApp.
- [x] Roles alumno, instructor y admin, con un botón de cuenta demo para cada uno.
- [x] Panel: agenda, plantillas, instructores, alumnos, pagos, métricas, precios, mensajes y modo oscuro.
- [x] `/caso`: comparador antes/después, tabla de los 7 problemas, simulación en vivo (prototipo 20 de 6, producción 6 y 14 en espera) sobre una clase aislada que se reinicia en cada corrida, con límite de uso, y métricas reales leídas de `docs/metricas`.
- [x] Stack: Next.js App Router, TypeScript estricto, Tailwind, PostgreSQL con migraciones de Drizzle, Better Auth (justificado en el README), Radix re-estilado, React Email + Mailpit, cron protegido, UTC en la base y hora de Buenos Aires en pantalla.
- [x] Vitest con test de concurrencia contra Postgres real y tests del webhook.
- [x] Playwright con al menos 5 flujos (hay 7).
- [x] Lighthouse móvil ≥ 90 en las 4 categorías para horarios (98/100/100/100), reserva (97/100/100/100) y `/caso` (97/100/100/100); `/antes` medido (76/88/100/90). Reportes en `docs/lighthouse`.
- [x] WCAG AA (contraste calculado en los dos temas, foco visible, teclado, movimiento reducido) y responsive de 360 a 1440 px.
- [x] CI en GitHub Actions.
- [x] README en español con resumen en inglés, diagramas Mermaid (arquitectura y flujo de reserva y pago), un comando para correr, variables, cuentas demo y cómo probar pagos.
- [x] `docs/screenshots`, `docs/caso-de-estudio.md`, `docs/guion-video.md` (90 s) y `docs/deploy.md` con costos.
- [x] Seguridad: ningún secreto en el repo, `.env.example` completo, rol verificado en cada acción del servidor, cron con secreto, límite de peticiones en reservas, pagos, login, panel y simulación.
- [x] Proveedor de pagos simulado: forzado en `test`, respaldo en `local` sin credenciales, imposible en producción (con test).
- [x] Modo simulado documentado en el README (pagos, emails, WhatsApp, cron).
- [x] Sin datos de contacto personales dentro de la app.
- [x] Cada fase cerró con tests en verde, capturas revisadas y un commit.

**Opcional** (después de lo imprescindible)

- [x] Reprogramar arrastrando en la agenda, con alternativa sin arrastrar en el panel lateral.
- [x] Exportar pagos a CSV.
- [x] Agregar la clase al calendario (`.ics`).

**Fuera del alcance de la demo**

- Deploy público: las instrucciones y costos están en `docs/deploy.md`; publicar requiere cuentas propias (Vercel, Neon, Resend, Mercado Pago).
- Envío real por WhatsApp (requiere WhatsApp Business): hoy es una vista previa.
