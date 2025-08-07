import { PrismaClient as BusinessPrismaClient } from '../node_modules/.prisma/business-client'

const globalForBusinessPrisma = globalThis as unknown as {
  businessPrisma: BusinessPrismaClient | undefined
}

// Create the base Prisma client
const baseBusinessPrisma = globalForBusinessPrisma.businessPrisma ?? new BusinessPrismaClient()

if (process.env.NODE_ENV !== 'production') globalForBusinessPrisma.businessPrisma = baseBusinessPrisma

// Define business data tables that should be read-only
const READ_ONLY_TABLES = [
  'gifts', // Main business data - CRITICAL: Never allow writes
  // Add other business tables here if they exist
]

// Create a read-only wrapper that prevents write operations on business data
export const businessPrisma = new Proxy(baseBusinessPrisma, {
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
export const baseBusinessPrismaClient = baseBusinessPrisma 