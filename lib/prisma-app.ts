import { PrismaClient } from '../node_modules/.prisma/app-client'

// Application database client - READ/WRITE
// This connects to your new SARA v2 application database
export const appPrisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.SARAV2_APP_DATABASE_URL,
    },
  },
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
})

// Graceful shutdown
process.on('beforeExit', async () => {
  await appPrisma.$disconnect()
})

export default appPrisma
