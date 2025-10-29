import { PrismaClient } from '../node_modules/.prisma/business-client'

// Business database client - READ ONLY
// This connects to your new SARA v2 business database
export const businessPrisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.SARAV2_BUSINESS_DATABASE_URL,
    },
  },
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
})

// Graceful shutdown
process.on('beforeExit', async () => {
  await businessPrisma.$disconnect()
})

export default businessPrisma
