# Deploy

La forma más barata de publicar Núcleo con todo funcionando (pagos de prueba, emails reales y
tareas programadas) es esta:

| Pieza              | Servicio                     | Por qué                                                                    |
| ------------------ | ---------------------------- | -------------------------------------------------------------------------- |
| App                | [Vercel](https://vercel.com) | Next.js sin configuración, previews por rama, región São Paulo (`gru1`).   |
| PostgreSQL         | [Neon](https://neon.com)     | Postgres 17 administrado, plan gratuito, región AWS São Paulo.             |
| Emails             | [Resend](https://resend.com) | API simple; la app lo usa si encuentra `RESEND_API_KEY`.                   |
| Pagos              | Mercado Pago Checkout Pro    | Cuenta de prueba: dinero ficticio, mismo flujo que en producción.          |
| Tareas programadas | GitHub Actions + Vercel Cron | Actions cada 15 minutos; el cron de Vercel, una vez por día como respaldo. |

Las tareas programadas son idempotentes y ninguna regla depende de que corran puntuales (una
retención vencida deja de ocupar lugar en la misma consulta que cuenta los lugares). La frecuencia
define qué tan rápido llegan los recordatorios y las ofertas de la lista de espera, no si el cupo es
correcto.

## Paso a paso

### 1. Base de datos (Neon)

1. Creá un proyecto con Postgres 17 en la región **AWS São Paulo (sa-east-1)**, la más cercana a
   Buenos Aires.
2. Copiá la cadena de **conexión directa** (la que no tiene `-pooler` en el host). La simulación de
   `/caso` usa `pg_try_advisory_lock` a nivel de sesión para que dos corridas no se pisen, y eso no
   funciona detrás de un pooler en modo transacción. Las reservas sí funcionarían con pooler (usan
   `SELECT … FOR UPDATE` dentro de una transacción), pero conviene una sola cadena para todo.
3. Desde tu máquina, aplicá las migraciones y cargá los datos de demo:

   ```bash
   DATABASE_URL="postgres://…neon.tech/neondb?sslmode=require" pnpm db:migrate
   ```

   ```bash
   DATABASE_URL="postgres://…neon.tech/neondb?sslmode=require" DEMO_PASSWORD="<la contraseña demo>" pnpm db:seed
   ```

Cada instancia de la app abre hasta 10 conexiones y la simulación, 22 por corrida (una sola a la
vez). El cómputo más chico de Neon admite bastante más que eso para una demo; si el tráfico crece,
pasá a la cadena con pooler y mové la simulación a su propia conexión directa.

### 2. Emails (Resend)

1. Verificá un dominio propio (registros DNS que indica Resend).
2. Creá una API key con permiso de envío.
3. `RESEND_API_KEY=<la key>` y `EMAIL_FROM="Núcleo <hola@tudominio.com>"`.

Sin dominio verificado Resend solo envía a la dirección de la cuenta. Para una demo alcanza:
todos los emails igual se ven en **Panel → Mensajes**.

### 3. Pagos (Mercado Pago, cuenta de prueba)

1. En [Tus integraciones](https://www.mercadopago.com.ar/developers/panel/app), creá una aplicación
   de Checkout Pro y, en **Cuentas de prueba**, una vendedora y una compradora.
2. Con la cuenta de prueba vendedora, copiá el Access Token a `MP_ACCESS_TOKEN`.
3. En **Webhooks**, configurá `https://<tu-dominio>/api/webhooks/mercadopago` con el evento
   **Pagos**. Copiá la clave secreta a `MP_WEBHOOK_SECRET`.
4. Probá con las tarjetas de prueba del [README](../README.md#con-mercado-pago-cuenta-de-prueba).

Para cobrar de verdad, se reemplazan esas dos variables por las credenciales de producción de la
cuenta real del estudio. No hay que cambiar código.

### 4. App (Vercel)

1. Importá el repositorio. Vercel detecta Next.js y usa `pnpm build`.
2. Cargá las variables de entorno en **Settings → Environment Variables** (producción):

   | Variable             | Valor                                       |
   | -------------------- | ------------------------------------------- |
   | `APP_ENV`            | `production` (prohíbe el pago simulado)     |
   | `APP_URL`            | `https://<tu-dominio>`                      |
   | `DATABASE_URL`       | La conexión directa de Neon                 |
   | `BETTER_AUTH_SECRET` | `openssl rand -base64 32`                   |
   | `DEMO_MODE`          | `1` para mostrar los botones de cuenta demo |
   | `DEMO_PASSWORD`      | La misma que usaste en el seed              |
   | `MP_ACCESS_TOKEN`    | Del paso 3                                  |
   | `MP_WEBHOOK_SECRET`  | Del paso 3                                  |
   | `RESEND_API_KEY`     | Del paso 2                                  |
   | `EMAIL_FROM`         | Del paso 2                                  |
   | `CRON_SECRET`        | `openssl rand -base64 24`                   |

   `DATABASE_URL_TEST`, `SMTP_URL` y `PAGOS_PROVEEDOR` no van en producción.

3. `vercel.json` fija la región `gru1` (São Paulo), junto a la base, y un cron diario a
   `/api/cron/todo` a las 9:00 UTC (6:00 en Buenos Aires). Vercel manda `CRON_SECRET` como
   `Authorization: Bearer …` sin configurar nada más.

### 5. Tareas programadas (GitHub Actions)

En el plan Hobby de Vercel el cron corre una vez por día. Para cada 15 minutos está
[`.github/workflows/cron.yml`](../.github/workflows/cron.yml):

1. En el repositorio, **Settings → Secrets and variables → Actions**: la variable `APP_URL` y el
   secreto `CRON_SECRET` (el mismo de Vercel).
2. Sin `APP_URL` el job no hace nada, así que el workflow puede estar en el repo desde el primer
   día.

GitHub no garantiza la hora exacta de los workflows programados (pueden demorarse en momentos de
mucha carga) y, en repositorios públicos, los desactiva después de 60 días sin actividad. Para un
estudio real conviene el cron de Vercel Pro, que corre cada minuto.

### 6. Verificación

- `https://<tu-dominio>/` muestra los horarios de la semana.
- **Entrar como alumno demo** → reservar una clase con crédito → aparece en Mis reservas.
- Pagar una clase suelta con la tarjeta `APRO` → vuelve a `/pago/[id]` con «Pagaste y
  reservaste» y en **Panel → Pagos** figura aprobado.
- `curl -H "Authorization: Bearer $CRON_SECRET" https://<tu-dominio>/api/cron/todo` responde 200
  con el resultado de cada tarea; sin el encabezado, 401.
- `/caso` → **Simular 20 reservas al mismo tiempo** termina en 6 de 6 y 14 en espera.

### Alternativa: un servidor con Docker

El [`Dockerfile`](../Dockerfile) genera una imagen standalone de Next.js (Node 24, usuario sin
privilegios, puerto 3030). En un VPS con Docker, `docker compose --profile completo up -d --build`
levanta base, migraciones, app y cron; para producción, cambiá en `docker-compose.yml` los valores
de desarrollo por variables reales (`APP_ENV=production`, secretos propios) y poné un proxy con
HTTPS adelante (Caddy, por ejemplo). Un VPS chico cuesta del orden de USD 5–10 por mes.

## Costos

Precios consultados el 27 de octubre de 2026 en las páginas oficiales. Cambian seguido: revisalos
antes de decidir.

| Servicio                                                                                     | Para la demo                                                               | Para un estudio real                                                                                                                                                                        |
| -------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Vercel](https://vercel.com/pricing)                                                         | Hobby, USD 0. Solo uso personal y no comercial; cron una vez por día.      | Pro, USD 20 por mes por miembro (uso comercial, cron cada minuto).                                                                                                                          |
| [Neon](https://neon.com/pricing)                                                             | Free, USD 0: 100 CU-hora por proyecto, se suspende tras 5 minutos sin uso. | Launch, sin mínimo: USD 0,106 por CU-hora y USD 0,35 por GB-mes. Estimado: USD 5–15/mes.                                                                                                    |
| [Resend](https://resend.com/pricing)                                                         | Free, USD 0: 3.000 emails por mes, 100 por día.                            | Pro, USD 20 por mes (50.000 emails) si se superan los 100 por día.                                                                                                                          |
| [Mercado Pago](https://www.mercadopago.com.ar/costs-section)                                 | Cuenta de prueba, sin costo.                                               | Sin costo fijo; comisión por cobro según medio de pago y plazo de acreditación.                                                                                                             |
| [GitHub Actions](https://docs.github.com/en/billing/concepts/product-billing/github-actions) | Gratis en repositorios públicos.                                           | En privados: 2.000 minutos por mes gratis. Cada 15 minutos son unas 2.900 corridas por mes y GitHub redondea cada corrida al minuto: conviene cada 30 minutos o usar el cron de Vercel Pro. |
| Dominio                                                                                      | Opcional: sin dominio, Vercel da `*.vercel.app`.                           | `.com.ar` en [NIC Argentina](https://nic.ar) o `.com` en cualquier registrador.                                                                                                             |

**Total para la demo: USD 0 por mes.** Para un estudio real, entre USD 25 y 55 por mes más las
comisiones de Mercado Pago, según cuántos emails mande y si usa el cron de Vercel Pro o el de
GitHub.
