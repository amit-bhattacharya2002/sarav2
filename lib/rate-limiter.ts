/**
 * Rate limiter for API routes to prevent abuse
 * Uses in-memory storage for simplicity, but can be extended to use Redis
 */

import { NextRequest } from 'next/server'
import { security, features } from './config'

interface RateLimitInfo {
  count: number
  resetTime: number
}

// In-memory storage for rate limiting
// In production, consider using Redis or a database
const rateLimitMap = new Map<string, RateLimitInfo>()

// Clean up expired entries every 5 minutes
setInterval(() => {
  const now = Date.now()
  for (const [key, info] of rateLimitMap.entries()) {
    if (now > info.resetTime) {
      rateLimitMap.delete(key)
    }
  }
}, 5 * 60 * 1000)

/**
 * Get client identifier for rate limiting
 */
function getClientId(request: NextRequest): string {
  // Try to get real IP from headers (when behind proxy)
  const forwardedFor = request.headers.get('x-forwarded-for')
  const realIp = request.headers.get('x-real-ip')
  const ip = forwardedFor?.split(',')[0] || realIp || 'unknown'
  
  return ip
}

/**
 * Check if request should be rate limited
 */
export function checkRateLimit(
  request: NextRequest,
  maxRequests: number = security.rateLimitRequests,
  windowMs: number = security.rateLimitWindow
): {
  allowed: boolean
  limit: number
  remaining: number
  resetTime: number
} {
  // Skip rate limiting if not enabled
  if (!features.enableRateLimiting) {
    return {
      allowed: true,
      limit: maxRequests,
      remaining: maxRequests - 1,
      resetTime: Date.now() + windowMs,
    }
  }

  const clientId = getClientId(request)
  const now = Date.now()
  const windowStart = now - windowMs

  // Get or create rate limit info for this client
  let rateLimitInfo = rateLimitMap.get(clientId)

  // Reset if window has expired
  if (!rateLimitInfo || now > rateLimitInfo.resetTime) {
    rateLimitInfo = {
      count: 0,
      resetTime: now + windowMs,
    }
  }

  // Increment request count
  rateLimitInfo.count++
  rateLimitMap.set(clientId, rateLimitInfo)

  const allowed = rateLimitInfo.count <= maxRequests
  const remaining = Math.max(0, maxRequests - rateLimitInfo.count)

  return {
    allowed,
    limit: maxRequests,
    remaining,
    resetTime: rateLimitInfo.resetTime,
  }
}

/**
 * Create rate limit headers for response
 */
export function createRateLimitHeaders(rateLimitResult: ReturnType<typeof checkRateLimit>) {
  return {
    'X-RateLimit-Limit': rateLimitResult.limit.toString(),
    'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
    'X-RateLimit-Reset': Math.ceil(rateLimitResult.resetTime / 1000).toString(),
  }
}

/**
 * Middleware-style rate limiter for API routes
 */
export async function rateLimit(
  request: NextRequest,
  maxRequests?: number,
  windowMs?: number
): Promise<Response | null> {
  const result = checkRateLimit(request, maxRequests, windowMs)
  
  if (!result.allowed) {
    return new Response(
      JSON.stringify({
        error: 'Too Many Requests',
        message: 'Rate limit exceeded. Please try again later.',
        retryAfter: Math.ceil((result.resetTime - Date.now()) / 1000),
      }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          ...createRateLimitHeaders(result),
          'Retry-After': Math.ceil((result.resetTime - Date.now()) / 1000).toString(),
        },
      }
    )
  }

  return null // No rate limiting applied
}

/**
 * Enhanced rate limiter with different limits for different endpoints
 */
export const rateLimiters = {
  // Strict limit for AI/OpenAI API calls (expensive)
  ai: (request: NextRequest) => rateLimit(request, 10, 60 * 1000), // 10 requests per minute
  
  // Medium limit for database queries
  query: (request: NextRequest) => rateLimit(request, 50, 60 * 1000), // 50 requests per minute
  
  // Generous limit for general API calls
  general: (request: NextRequest) => rateLimit(request, 100, 60 * 1000), // 100 requests per minute
  
  // Very strict for authentication endpoints
  auth: (request: NextRequest) => rateLimit(request, 5, 60 * 1000), // 5 requests per minute
} as const 