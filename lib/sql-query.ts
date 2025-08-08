import { prisma } from './prisma'
import { validateSqlQuery, validateAiGeneratedQuery, logValidationResult } from './sql-validator'

export interface QueryResult {
  success: boolean
  rows?: any[]
  columns?: { key: string; name: string }[]
  error?: string
}

export async function executeSQLQuery(sql: string, originalQuestion?: string): Promise<QueryResult> {
  try {
    // Enhanced validation using our new validator
    const validation = originalQuestion 
      ? validateAiGeneratedQuery(sql, originalQuestion)
      : validateSqlQuery(sql)
    
    // Log validation result for monitoring
    logValidationResult(sql, validation, originalQuestion ? 'AI_GENERATED' : 'MANUAL')
    
    if (!validation.isValid) {
      return {
        success: false,
        error: validation.error || 'Query validation failed'
      }
    }
    
    // Show warnings in console but don't block execution
    if (validation.warnings && validation.warnings.length > 0) {
      console.warn('⚠️ SQL Query Warnings:', validation.warnings)
    }

    // Execute raw SQL query using Prisma
    const result = await prisma.$queryRawUnsafe(sql)
    
    if (!result || (Array.isArray(result) && result.length === 0)) {
      return {
        success: true,
        rows: [],
        columns: []
      }
    }

    const rows = Array.isArray(result) ? result : [result]
    
    if (rows.length === 0) {
      return {
        success: true,
        rows: [],
        columns: []
      }
    }

    // Extract column names from the first row
    const firstRow = rows[0]
    const columns = Object.keys(firstRow).map(key => ({
      key,
      name: key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())
    }))

    return {
      success: true,
      rows,
      columns
    }

  } catch (error) {
    console.error('SQL query error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

// Helper function to convert natural language to SQL
export function generateSQLFromQuestion(question: string): string {
  const lowerQuestion = question.toLowerCase()
  
  // Basic SQL generation based on question patterns
  if (lowerQuestion.includes('top') && lowerQuestion.includes('donor')) {
    return `
      SELECT 
        ACCOUNTID,
        SUM(CAST(GIFTAMOUNT AS DECIMAL(15,2))) as totalAmount
      FROM gifts
      GROUP BY ACCOUNTID
      ORDER BY totalAmount DESC
      LIMIT 10
    `
  }
  
  if (lowerQuestion.includes('gift') && lowerQuestion.includes('source')) {
    return `
      SELECT 
        SOURCECODE,
        COUNT(*) as giftCount,
        SUM(CAST(GIFTAMOUNT AS DECIMAL(15,2))) as totalAmount
      FROM gifts
      GROUP BY SOURCECODE
      ORDER BY totalAmount DESC
    `
  }
  
  if (lowerQuestion.includes('designation')) {
    return `
      SELECT 
        DESIGNATION,
        COUNT(*) as giftCount,
        SUM(CAST(GIFTAMOUNT AS DECIMAL(15,2))) as totalAmount
      FROM gifts
      GROUP BY DESIGNATION
      ORDER BY totalAmount DESC
    `
  }
  
  if (lowerQuestion.includes('payment method')) {
    return `
      SELECT 
        PAYMENTMETHOD,
        COUNT(*) as giftCount,
        SUM(CAST(GIFTAMOUNT AS DECIMAL(15,2))) as totalAmount
      FROM gifts
      GROUP BY PAYMENTMETHOD
      ORDER BY totalAmount DESC
    `
  }
  
  // Default query
  return `
    SELECT 
      GIFTID,
      ACCOUNTID,
      GIFTDATE,
      GIFTAMOUNT,
      SOURCECODE,
      DESIGNATION,
      PAYMENTMETHOD
    FROM gifts
    ORDER BY GIFTDATE DESC
    LIMIT 50
  `
} 