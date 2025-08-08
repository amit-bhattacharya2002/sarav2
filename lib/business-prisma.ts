// Dynamic import to handle Prisma client generation
let BusinessPrismaClient: any

try {
  const module = require('../node_modules/.prisma/business-client')
  BusinessPrismaClient = module.PrismaClient
} catch (error) {
  console.error('Failed to import business Prisma client:', error)
  // Fallback for when client is not generated yet
  BusinessPrismaClient = class MockPrismaClient {
    constructor() {
      throw new Error('Prisma client not generated. Run "npm run db:generate" first.')
    }
  }
}

const globalForBusinessPrisma = globalThis as unknown as {
  businessPrisma: any | undefined
}

// Create Prisma client with proper configuration for deployment
const createBusinessPrismaClient = () => {
  // Set environment variables for Vercel deployment
  if (process.env.VERCEL) {
    process.env.PRISMA_QUERY_ENGINE_TYPE = 'binary'
    process.env.PRISMA_QUERY_ENGINE_LIBRARY = 'binary'
  }

  const client = new BusinessPrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
    errorFormat: 'pretty',
  })

  // Handle connection errors gracefully
  client.$connect().catch((error: unknown) => {
    console.error('Failed to connect to business database:', error)
    // Don't throw in production to prevent app crashes
    if (process.env.NODE_ENV === 'development') {
      throw error
    }
  })

  return client
}

// Create a singleton instance
const businessPrisma = globalForBusinessPrisma.businessPrisma ?? createBusinessPrismaClient()

if (process.env.NODE_ENV !== 'production') globalForBusinessPrisma.businessPrisma = businessPrisma

export { businessPrisma } 