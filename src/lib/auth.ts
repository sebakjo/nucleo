import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { nextCookies } from 'better-auth/next-js'
import { db } from '@/db'
import { account, rateLimit, session, user, verification } from '@/db/schema'

/**
 * Better Auth: email y contraseña (scrypt), sesiones guardadas en Postgres (revocables) y el rol
 * como campo adicional del usuario. El rol no se puede mandar desde el registro (`input: false`):
 * toda cuenta nueva es "alumno" y solo un admin (o el seed) asigna otro rol.
 */
export const auth = betterAuth({
  appName: 'Núcleo',
  baseURL: process.env.APP_URL ?? 'http://localhost:3030',
  secret: process.env.BETTER_AUTH_SECRET,
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema: { user, session, account, verification, rateLimit },
  }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    maxPasswordLength: 128,
    autoSignIn: true,
  },
  user: {
    additionalFields: {
      role: { type: 'string', required: false, defaultValue: 'alumno', input: false },
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 30,
    updateAge: 60 * 60 * 24,
    cookieCache: { enabled: true, maxAge: 60 },
  },
  rateLimit: {
    enabled: process.env.APP_ENV !== 'test',
    storage: 'database',
    window: 60,
    max: 60,
    customRules: {
      '/sign-in/email': { window: 60, max: 10 },
      '/sign-up/email': { window: 300, max: 5 },
    },
  },
  plugins: [nextCookies()],
})
