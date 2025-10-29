import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// Create the base Prisma client with connection pooling optimization
// This connects to your new SARA v2 database (completely separate from production)
const basePrisma = globalForPrisma.prisma ?? new PrismaClient({
  datasources: {
    db: {
      url: process.env.SARAV2_DATABASE_URL
    }
  },
  // Connection pooling optimization
  log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
})

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = basePrisma

// Define business data tables that should be read-only
const READ_ONLY_TABLES = [
  'healthstaff_schedule', // Main business data - CRITICAL: Never allow writes
  // Add other business tables here if they exist
]

// Create a read-only wrapper that prevents write operations on business data
export const businessPrisma = new Proxy(basePrisma, {
  get(target, prop) {
    // If accessing a model that should be read-only
    if (typeof prop === 'string' && READ_ONLY_TABLES.includes(prop.toLowerCase())) {
      const model = target[prop as keyof typeof target]
      
      // Return a read-only version of the model
      return new Proxy(model, {
        get(modelTarget, modelProp) {
          // Block all write operations
          if (typeof modelProp === 'string' && [
            'create',
            'createMany', 
            'update',
            'updateMany',
            'upsert',
            'delete',
            'deleteMany',
            'executeRaw',
            'queryRaw'
          ].includes(modelProp)) {
            throw new Error(`🚫 WRITE OPERATION BLOCKED: Cannot perform '${modelProp}' on '${prop}' table. This is a read-only business database.`)
          }
          
          // Allow read operations
          return modelTarget[modelProp as keyof typeof modelTarget]
        }
      })
    }
    
    // For non-business tables (like saved_queries, saved_dashboards), allow normal operations
    return target[prop as keyof typeof target]
  }
})

// Export the base client for emergency use (with warning)
export const basePrismaClient = basePrisma 