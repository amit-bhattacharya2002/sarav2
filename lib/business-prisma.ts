import { PrismaClient as BusinessPrismaClient } from '../node_modules/.prisma/business-client'

const globalForBusinessPrisma = globalThis as unknown as {
  businessPrisma: BusinessPrismaClient | undefined
}

export const businessPrisma = globalForBusinessPrisma.businessPrisma ?? new BusinessPrismaClient()

if (process.env.NODE_ENV !== 'production') globalForBusinessPrisma.businessPrisma = businessPrisma 