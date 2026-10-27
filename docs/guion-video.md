# Guion del video (90 segundos)

Para el perfil de Workana y el README. Grabación de pantalla a 1440 × 900 con la app en local
(`pnpm demo`), voz en off y subtítulos quemados (mucha gente lo ve sin sonido). Unas 210 palabras
de locución: ritmo tranquilo, sin música encima de la voz.

**Preparación:** `pnpm db:reset` antes de grabar, sesión cerrada, zoom del navegador al 100 %,
notificaciones del sistema apagadas. Tener abiertas en pestañas `/caso`, `/antes`, `/` y Mailpit.

| Tiempo    | Pantalla                                                                                                           | Locución                                                                                                                                                            | Texto en pantalla                       |
| --------- | ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| 0:00–0:08 | `/caso`, sección de la simulación. Clic en **Simular 20 reservas al mismo tiempo**; se llenan los carriles.        | «Una clase de pilates tiene 6 lugares. Veinte personas reservan al mismo tiempo.»                                                                                   | 20 personas · 6 lugares                 |
| 0:08–0:18 | Termina la simulación: a la izquierda 20 de 6 en rojo, a la derecha 6 de 6 y 14 en espera.                         | «El prototipo vende veinte. La versión de producción vende seis y anota a las otras catorce en la lista de espera, en orden. Esto corre de verdad, contra la base.» | Prototipo: 20 de 6 · Producción: 6 + 14 |
| 0:18–0:28 | `/antes`; scroll lento hasta un comentario `// PROBLEMA:` en el código (vista de código o DevTools).               | «El punto de partida fue este prototipo de un solo archivo. Funcionaba en la demo, pero tenía siete problemas que aparecen recién con gente real.»                  | 7 problemas                             |
| 0:28–0:36 | `/caso`, tabla de los 7 problemas; cursor sobre las filas del precio y del pago.                                   | «Precios que se podían cambiar desde el navegador, pagos que se marcaban como hechos sin cobrar, reservas que solo existían en cada compu.»                         | —                                       |
| 0:36–0:50 | `/` horarios → clase del jueves 18:00 → **Entrar como alumno demo** → confirmar con crédito → paso 3.              | «Ahora el alumno ve la disponibilidad en tiempo real, reserva en tres pasos y sabe qué reformer le toca.»                                                           | Reserva en 3 pasos                      |
| 0:50–1:00 | Otra clase → pagar la clase suelta → checkout de Mercado Pago (o el simulado) → vuelve con «Pagaste y reservaste». | «Si paga la clase suelta, el lugar queda retenido diez minutos mientras paga con Mercado Pago. El webhook verifica la firma y consulta el estado real.»             | Mercado Pago · webhook firmado          |
| 1:00–1:08 | Mis reservas → **Cancelar**: el diálogo explica que con más de 12 horas el crédito vuelve. Mailpit con el email.   | «Cancelar con más de doce horas devuelve el crédito, y el lugar pasa solo a la primera persona de la lista.»                                                        | Regla de 12 horas                       |
| 1:08–1:20 | `/admin`: agenda → panel lateral de una clase → métricas → **Modo oscuro**.                                        | «El estudio tiene su panel: agenda, plantillas, alumnos, pagos y métricas de la semana.»                                                                            | Panel del estudio                       |
| 1:20–1:30 | `/caso`, métricas: Lighthouse y tests. Cierre en la portada con el logo.                                           | «Cuarenta y ocho tests contra Postgres real, cinco flujos de punta a punta y Lighthouse sobre noventa y siete en el teléfono. De prototipo a producción.»           | Núcleo · De prototipo a producción      |

## Notas de edición

- Cortes secos, sin transiciones. Acelerar ×1,5 solo los tramos de tipeo y navegación.
- El clic en la simulación va en el segundo 1: es el gancho y tiene que verse antes de que alguien
  siga de largo.
- El rojo de la sobreventa es el único rojo del video; no agregar otros resaltados en rojo.
- Aviso fijo en una esquina durante todo el video: «Proyecto de demostración: los pagos funcionan
  en modo de prueba».
- Exportar en 1080p, H.264, y una versión vertical 1080 × 1920 recortada en la simulación y el
  flujo de reserva en el teléfono (`docs/screenshots/*-movil.png` como referencia del encuadre).
