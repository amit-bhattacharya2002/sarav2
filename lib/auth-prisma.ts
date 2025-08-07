import { PrismaClient as AuthPrismaClient } from '../node_modules/.prisma/auth-client'

const globalForAuthPrisma = globalThis as unknown as {
  authPrisma: AuthPrismaClient | undefined
}

export const authPrisma = globalForAuthPrisma.authPrisma ?? new AuthPrismaClient()

if (process.env.NODE_ENV !== 'production') globalForAuthPrisma.authPrisma = authPrisma 