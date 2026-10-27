# Lighthouse

Lighthouse 13.5.0 en modo móvil (emulación de teléfono y red 4G lenta, los valores por defecto),
contra un build de producción (`pnpm build && pnpm start`) con PostgreSQL en Docker en la misma
máquina. Cada página se mide 3 veces después de calentar el servidor y se guarda la corrida
mediana. Medido el 2026-10-27.

| Página | Rendimiento | Accesibilidad | Buenas prácticas | SEO | LCP | CLS | Rendimiento en las 3 corridas |
|---|---:|---:|---:|---:|---:|---:|---|
| [Prototipo (antes)](prototipo.report.html) `/antes` | 76 | 88 | 100 | 90 | 3.2 s | 0.214 | 76, 76, 76 |
| [Horarios](horarios.report.html) `/` | 98 | 100 | 100 | 100 | 2.4 s | 0 | 98, 98, 97 |
| [Reserva](reserva.report.html) `/clase/[id]` | 97 | 100 | 100 | 100 | 2.6 s | 0 | 96, 98, 97 |
| [Caso de estudio](caso.report.html) `/caso` | 97 | 100 | 100 | 100 | 2.6 s | 0 | 97, 96, 97 |

Cada página tiene su reporte en HTML (para abrir en el navegador) y en JSON. Para repetir la
medición: `pnpm lighthouse http://localhost:3030` con la app en producción.
