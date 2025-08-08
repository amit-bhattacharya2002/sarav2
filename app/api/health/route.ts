import { NextRequest, NextResponse } from 'next/server'
import { config, validateConfig, app } from '@/lib/config'

export async function GET(req: NextRequest) {
  try {
    // Check if we're in build mode
    if (app.isBuildTime) {
      return NextResponse.json({
        status: 'build-mode',
        timestamp: new Date().toISOString(),
        message: 'Service is in build mode',
      }, { status: 200 })
    }

    // Basic health check
    const health = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: config.app.version,
      environment: config.app.environment,
      uptime: process.uptime(),
    }

    // Check critical dependencies
    const checks = {
      database: await checkDatabase(),
      openai: checkOpenAI(),
      config: checkConfiguration(),
    }

    const allChecksPass = Object.values(checks).every(check => check.status === 'ok')

    return NextResponse.json({
      ...health,
      status: allChecksPass ? 'ok' : 'degraded',
      checks,
    }, {
      status: allChecksPass ? 200 : 503,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      }
    })

  } catch (error: any) {
    return NextResponse.json({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: config.features.enableDetailedErrors ? error.message : 'Health check failed',
    }, {
      status: 500,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      }
    })
  }
}

async function checkDatabase() {
  try {
    // Runtime check for database URL
    if (!process.env.DATABASE_URL || process.env.DATABASE_URL.includes('placeholder')) {
      return {
        status: 'error',
        message: 'Database URL not configured',
      }
    }

    // Import Prisma client dynamically to avoid circular dependencies
    const { businessPrisma } = await import('@/lib/mysql-prisma')
    
    // Simple connection test
    await businessPrisma.$queryRaw`SELECT 1 as test`
    
    return {
      status: 'ok',
      message: 'Database connection successful',
    }
  } catch (error: any) {
    return {
      status: 'error',
      message: config.features.enableDetailedErrors 
        ? `Database connection failed: ${error.message}`
        : 'Database connection failed',
    }
  }
}

function checkOpenAI() {
  try {
    if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY.includes('placeholder')) {
      return {
        status: 'error',
        message: 'OpenAI API key not configured',
      }
    }

    if (!config.openai.apiKey.startsWith('sk-')) {
      return {
        status: 'error',
        message: 'Invalid OpenAI API key format',
      }
    }

    return {
      status: 'ok',
      message: 'OpenAI configuration valid',
    }
  } catch (error: any) {
    return {
      status: 'error',
      message: config.features.enableDetailedErrors 
        ? `OpenAI check failed: ${error.message}`
        : 'OpenAI configuration invalid',
    }
  }
}

function checkConfiguration() {
  try {
    // Runtime environment check
    if (app.isBuildTime) {
      return {
        status: 'build-mode',
        message: 'Configuration validation skipped during build',
      }
    }

    validateConfig()
    return {
      status: 'ok',
      message: 'Configuration valid',
    }
  } catch (error: any) {
    return {
      status: 'error',
      message: config.features.enableDetailedErrors 
        ? `Configuration invalid: ${error.message}`
        : 'Configuration validation failed',
    }
  }
} 