// SQL Query Validator - Ensures read-only access to business data
// This is a critical security component

const READ_ONLY_TABLES = [
  'gifts',
  'gift', // lowercase variant
  // Add other business tables here
]

const WRITE_OPERATIONS = [
  'INSERT',
  'UPDATE', 
  'DELETE',
  'DROP',
  'TRUNCATE',
  'ALTER',
  'CREATE',
  'RENAME',
  'GRANT',
  'REVOKE'
]

const WRITE_OPERATIONS_REGEX = new RegExp(
  `\\b(${WRITE_OPERATIONS.join('|')})\\b`, 
  'i'
)

export interface ValidationResult {
  isValid: boolean
  error?: string
  warnings?: string[]
}

export function validateSqlQuery(sql: string): ValidationResult {
  const upperSql = sql.toUpperCase()
  const warnings: string[] = []
  
  // Check for write operations
  if (WRITE_OPERATIONS_REGEX.test(upperSql)) {
    return {
      isValid: false,
      error: `🚫 WRITE OPERATION DETECTED: SQL contains write operation. Only SELECT queries are allowed on business data.`
    }
  }
  
  // Check if query targets read-only tables
  const hasReadOnlyTable = READ_ONLY_TABLES.some(table => 
    upperSql.includes(table.toUpperCase())
  )
  
  if (hasReadOnlyTable) {
    // Additional validation for read-only tables
    if (upperSql.includes('WHERE') && upperSql.includes('DELETE')) {
      return {
        isValid: false,
        error: `🚫 DELETE OPERATION BLOCKED: Cannot delete from business data tables.`
      }
    }
    
    if (upperSql.includes('SET') && upperSql.includes('UPDATE')) {
      return {
        isValid: false,
        error: `🚫 UPDATE OPERATION BLOCKED: Cannot update business data tables.`
      }
    }
    
    if (upperSql.includes('INSERT')) {
      return {
        isValid: false,
        error: `🚫 INSERT OPERATION BLOCKED: Cannot insert into business data tables.`
      }
    }
  }
  
  // Check for potentially dangerous operations
  if (upperSql.includes('INTO') && upperSql.includes('SELECT')) {
    warnings.push('⚠️ SELECT INTO detected - ensure this is safe')
  }
  
  if (upperSql.includes('EXEC') || upperSql.includes('EXECUTE')) {
    return {
      isValid: false,
      error: `🚫 EXECUTE OPERATION BLOCKED: Cannot execute stored procedures on business data.`
    }
  }
  
  // Check for suspicious patterns
  if (upperSql.includes('UNION') && !upperSql.includes('SELECT')) {
    warnings.push('⚠️ UNION without SELECT detected')
  }
  
  if (upperSql.includes('--') || upperSql.includes('/*')) {
    warnings.push('⚠️ SQL comments detected')
  }
  
  return {
    isValid: true,
    warnings: warnings.length > 0 ? warnings : undefined
  }
}

// Enhanced validation for AI-generated queries
export function validateAiGeneratedQuery(sql: string, originalQuestion: string): ValidationResult {
  const baseValidation = validateSqlQuery(sql)
  
  if (!baseValidation.isValid) {
    return baseValidation
  }
  
  // Additional checks for AI-generated queries
  const upperSql = sql.toUpperCase()
  
  // Ensure AI queries are SELECT only
  if (!upperSql.trim().startsWith('SELECT')) {
    return {
      isValid: false,
      error: `🚫 AI QUERY VALIDATION FAILED: AI-generated queries must be SELECT statements only.`
    }
  }
  
  // Check for suspicious patterns in AI queries
  if (upperSql.includes('INFORMATION_SCHEMA') || upperSql.includes('SYS.')) {
    return {
      isValid: false,
      error: `🚫 SYSTEM TABLE ACCESS BLOCKED: Cannot access system tables.`
    }
  }
  
  return baseValidation
}

// Log validation results for monitoring
export function logValidationResult(sql: string, result: ValidationResult, context?: string) {
  const logData = {
    timestamp: new Date().toISOString(),
    context: context || 'SQL_VALIDATION',
    sql: sql.substring(0, 200) + (sql.length > 200 ? '...' : ''),
    isValid: result.isValid,
    error: result.error,
    warnings: result.warnings
  }
  
  console.log('🔒 SQL Validation:', logData)
  
  if (!result.isValid) {
    console.error('🚫 SQL VALIDATION FAILED:', result.error)
  }
} 