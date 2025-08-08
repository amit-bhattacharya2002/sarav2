/**
 * Centralized configuration for the SARA application
 * Handles environment variables, validation, and app constants
 */

// Environment validation helper
function requireEnv(key: string): string {
  const value = process.env[key]
  if (!value) {
    // During build time, some environment variables might not be available
    if (process.env.NODE_ENV === 'production' && process.env.VERCEL_ENV !== 'production') {
      console.warn(`Warning: Missing environment variable: ${key} (build time)`)
      return `placeholder-${key.toLowerCase()}`
    }
    throw new Error(`Missing required environment variable: ${key}`)
  }
  return value
}

function getEnv(key: string, defaultValue: string = ''): string {
  return process.env[key] ?? defaultValue
}

// Check if we're in build mode
const isBuildTime = process.env.NODE_ENV === 'production' && !process.env.VERCEL_ENV

// Database Configuration
export const database = {
  businessUrl: isBuildTime ? 'mysql://placeholder:placeholder@localhost:3306/placeholder' : requireEnv('DATABASE_URL'),
  authUrl: isBuildTime ? 'mysql://placeholder:placeholder@localhost:3306/placeholder' : getEnv('AUTH_DATABASE_URL', requireEnv('DATABASE_URL')),
} as const

// OpenAI Configuration
export const openai = {
  apiKey: isBuildTime ? 'sk-placeholder' : requireEnv('OPENAI_API_KEY'),
  model: getEnv('OPENAI_MODEL', 'gpt-4'),
  maxTokens: parseInt(getEnv('OPENAI_MAX_TOKENS', '2000')),
  temperature: parseFloat(getEnv('OPENAI_TEMPERATURE', '0')),
} as const

// Application Configuration
export const app = {
  name: 'SARA - Smart Analytics & Reporting Assistant',
  version: '1.0.0',
  environment: getEnv('NODE_ENV', 'development'),
  url: getEnv('NEXTAUTH_URL', 'http://localhost:3000'),
  isProduction: process.env.NODE_ENV === 'production',
  isDevelopment: process.env.NODE_ENV === 'development',
  isBuildTime,
} as const

// Security Configuration
export const security = {
  jwtSecret: getEnv('JWT_SECRET', 'default-dev-secret'),
  nextAuthSecret: getEnv('NEXTAUTH_SECRET', 'default-dev-secret'),
  rateLimitRequests: parseInt(getEnv('RATE_LIMIT_REQUESTS', '100')),
  rateLimitWindow: parseInt(getEnv('RATE_LIMIT_WINDOW', '900000')), // 15 minutes
} as const

// Optional Services Configuration
export const services = {
  mongodb: {
    uri: getEnv('MONGODB_URI'),
    enabled: Boolean(getEnv('MONGODB_URI')),
  },
  analytics: {
    googleAnalyticsId: getEnv('GOOGLE_ANALYTICS_ID'),
    enabled: Boolean(getEnv('GOOGLE_ANALYTICS_ID')),
  },
  email: {
    host: getEnv('SMTP_HOST'),
    port: parseInt(getEnv('SMTP_PORT', '587')),
    user: getEnv('SMTP_USER'),
    pass: getEnv('SMTP_PASS'),
    enabled: Boolean(getEnv('SMTP_HOST') && getEnv('SMTP_USER')),
  },
} as const

// API Configuration
export const api = {
  timeout: parseInt(getEnv('API_TIMEOUT', '30000')), // 30 seconds
  retries: parseInt(getEnv('API_RETRIES', '3')),
  baseUrl: app.url,
} as const

// Feature Flags
export const features = {
  enableAnalytics: services.analytics.enabled && app.isProduction,
  enableEmailNotifications: services.email.enabled,
  enableRateLimiting: app.isProduction && !app.isBuildTime,
  enableDetailedErrors: app.isDevelopment || app.isBuildTime,
} as const

// Vercel-specific configuration
export const vercel = {
  url: getEnv('VERCEL_URL'),
  env: getEnv('VERCEL_ENV'),
  region: getEnv('VERCEL_REGION'),
  isVercel: Boolean(getEnv('VERCEL')),
} as const

// Validation function to check all required environment variables
export function validateConfig(): void {
  // Skip validation during build time
  if (app.isBuildTime) {
    console.log('⏭️  Skipping configuration validation during build time')
    return
  }

  const errors: string[] = []

  try {
    requireEnv('DATABASE_URL')
  } catch (e) {
    errors.push('DATABASE_URL is required')
  }

  try {
    requireEnv('OPENAI_API_KEY')
  } catch (e) {
    errors.push('OPENAI_API_KEY is required')
  }

  if (app.isProduction) {
    if (!security.nextAuthSecret || security.nextAuthSecret === 'default-dev-secret') {
      errors.push('NEXTAUTH_SECRET must be set in production')
    }
    
    if (!security.jwtSecret || security.jwtSecret === 'default-dev-secret') {
      errors.push('JWT_SECRET must be set in production')
    }

    if (!app.url.startsWith('https://')) {
      errors.push('NEXTAUTH_URL must use HTTPS in production')
    }
  }

  if (errors.length > 0) {
    throw new Error(`Configuration validation failed:\n${errors.join('\n')}`)
  }

  console.log('✅ Configuration validation passed')
}

// Export all configurations as a single object for convenience
export const config = {
  database,
  openai,
  app,
  security,
  services,
  api,
  features,
  vercel,
} as const

// Validate configuration on import in production (but not during build)
if (app.isProduction && !app.isBuildTime) {
  validateConfig()
} 