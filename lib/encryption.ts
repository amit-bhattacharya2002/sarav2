import crypto from 'crypto'

// Use a secret key for encryption - in production, this should be in environment variables
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'your-secret-key-32-chars-long!!'

// Validate encryption key length
if (ENCRYPTION_KEY.length < 32) {
  console.warn('ENCRYPTION_KEY should be at least 32 characters long for security')
}

/**
 * Encrypts a dashboard ID to create a secure shareable token
 */
export function encryptDashboardId(dashboardId: number): string {
  try {
    // Create a simple but secure hash-based encryption
    const data = `${dashboardId}:${ENCRYPTION_KEY}`
    const hash = crypto.createHash('sha256').update(data).digest('hex')
    
    // Combine dashboard ID with hash for verification using dash separator
    const result = `${dashboardId.toString(36)}-${hash.slice(0, 16)}`
    
    return result
  } catch (error) {
    console.error('Encryption error:', error)
    throw new Error('Failed to encrypt dashboard ID')
  }
}

/**
 * Decrypts a shareable token back to a dashboard ID
 */
export function decryptDashboardId(encryptedId: string): number {
  try {
    // Handle legacy format (plain dashboard ID)
    if (/^\d+$/.test(encryptedId)) {
      const dashboardId = parseInt(encryptedId, 10)
      if (isNaN(dashboardId) || dashboardId <= 0) {
        throw new Error('Invalid dashboard ID')
      }
      return dashboardId
    }
    
    // Handle empty or invalid input
    if (!encryptedId || typeof encryptedId !== 'string') {
      throw new Error('Invalid encrypted ID provided')
    }
    
    // Split dashboard ID and hash - try dash first, then colon for backward compatibility
    let parts = encryptedId.split('-')
    
    if (parts.length !== 2) {
      // Try colon separator for backward compatibility
      parts = encryptedId.split(':')
      
      if (parts.length !== 2) {
        // Try to handle as a plain number (fallback for edge cases)
        const possibleId = parseInt(encryptedId, 10)
        if (!isNaN(possibleId) && possibleId > 0) {
          return possibleId
        }
        throw new Error(`Invalid encrypted format: "${encryptedId}"`)
      }
    }
    
    const dashboardIdBase36 = parts[0]
    const providedHash = parts[1]
    
    // Convert from base36 to number
    const dashboardId = parseInt(dashboardIdBase36, 36)
    
    if (isNaN(dashboardId) || dashboardId <= 0) {
      throw new Error('Invalid dashboard ID')
    }
    
    // Verify the hash
    const data = `${dashboardId}:${ENCRYPTION_KEY}`
    const expectedHash = crypto.createHash('sha256').update(data).digest('hex').slice(0, 16)
    
    if (providedHash !== expectedHash) {
      throw new Error('Invalid or corrupted share link')
    }
    
    return dashboardId
  } catch (error) {
    console.error('Decryption error:', error)
    throw new Error('Invalid or corrupted share link')
  }
}

/**
 * Validates if a string is a valid encrypted dashboard ID
 */
export function isValidEncryptedId(encryptedId: string): boolean {
  try {
    decryptDashboardId(encryptedId)
    return true
  } catch {
    return false
  }
}
