// File: app/api/generate-sql/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { openai as openaiConfig, features, app } from '@/lib/config'
import { rateLimiters, createRateLimitHeaders, checkRateLimit } from '@/lib/rate-limiter'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    // Check if we're in build mode
    if (app.isBuildTime) {
      return NextResponse.json({ error: 'Service unavailable during build' }, { status: 503 })
    }

    // Runtime validation of required environment variables
    if (!process.env.OPENAI_API_KEY || !process.env.BUSINESS_DATABASE_URL) {
      return NextResponse.json({ 
        error: 'Service configuration error',
        message: 'Required environment variables are not configured'
      }, { status: 500 })
    }

    // Apply rate limiting for AI endpoints (strict limit)
    const rateLimitResult = checkRateLimit(req, 10, 60 * 1000) // 10 requests per minute
    
    if (!rateLimitResult.allowed) {
      return new Response(
        JSON.stringify({
          error: 'Too Many Requests',
          message: 'Rate limit exceeded. Please try again later.',
          retryAfter: Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000),
        }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            ...createRateLimitHeaders(rateLimitResult),
            'Retry-After': Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000).toString(),
          },
        }
      )
    }

    const { default: OpenAI } = await import('openai')
    const openai = new OpenAI({ apiKey: openaiConfig.apiKey })

    const { question } = await req.json()
    if (!question) {
      return NextResponse.json({ error: 'Missing question input' }, { status: 400 })
    }

    // Use hardcoded schema for MySQL business database
    const schemaText = `
    MySQL Database Schema:
    - gifts table: id, ACCOUNTID, GIFTID, GIFTDATE, GIFTAMOUNT, TRANSACTIONTYPE, GIFTTYPE, PAYMENTMETHOD, PLEDGEID, SOFTCREDITINDICATOR, SOFTCREDITAMOUNT, SOFTCREDITID, SOURCECODE, DESIGNATION, UNIT, PURPOSECATEGORY, APPEAL, GIVINGLEVEL, UUID
    `;

    // 2. Construct full prompt for SQL generation
    const baseInstruction = `
    You are an assistant that converts natural language questions into SQL queries for a MySQL database.
    Only use SELECT queries — do not modify the database.
    Always use proper field names and table aliases.
    You may only reference fields listed in the schema.
    IMPORTANT: Always SELECT ALL available fields from the table to provide complete data for analysis.
    Respond ONLY with valid SQL query code — no explanation.

    Database Schema:
    - gifts table: id, ACCOUNTID, GIFTID, GIFTDATE, GIFTAMOUNT, TRANSACTIONTYPE, GIFTTYPE, PAYMENTMETHOD, PLEDGEID, SOFTCREDITINDICATOR, SOFTCREDITAMOUNT, SOFTCREDITID, SOURCECODE, DESIGNATION, UNIT, PURPOSECATEGORY, APPEAL, GIVINGLEVEL, UUID

    Common patterns:
    - For "top donors": SELECT *, SUM(CAST(GIFTAMOUNT AS DECIMAL(15,2))) as totalAmount FROM gifts GROUP BY ACCOUNTID ORDER BY totalAmount DESC LIMIT N
    - For "gifts by source": SELECT *, COUNT(*) as giftCount, SUM(CAST(GIFTAMOUNT AS DECIMAL(15,2))) as totalAmount FROM gifts GROUP BY SOURCECODE ORDER BY totalAmount DESC
    - For "gifts by designation": SELECT *, COUNT(*) as giftCount, SUM(CAST(GIFTAMOUNT AS DECIMAL(15,2))) as totalAmount FROM gifts GROUP BY DESIGNATION ORDER BY totalAmount DESC
    - For "payment methods": SELECT *, COUNT(*) as giftCount, SUM(CAST(GIFTAMOUNT AS DECIMAL(15,2))) as totalAmount FROM gifts GROUP BY PAYMENTMETHOD ORDER BY totalAmount DESC

    Always use CAST(GIFTAMOUNT AS DECIMAL(15,2)) for amount calculations.
    Use GROUP BY for aggregations.
    Use ORDER BY for sorting.
    Use LIMIT for limiting results.
    All column names are in UPPERCASE.
    Always include SELECT * to return all available fields for complete data analysis.
    `;
    
    const fullSystemPrompt = `${schemaText}\n\n${baseInstruction}`

    const completion = await openai.chat.completions.create({
      model: openaiConfig.model,
      messages: [
        { role: 'system', content: fullSystemPrompt },
        { role: 'user', content: question },
      ],
      temperature: openaiConfig.temperature,
      max_tokens: openaiConfig.maxTokens,
    })

    const sqlQuery = completion.choices[0].message.content?.trim() || ''
    
    // Add rate limit headers to successful response
    const response = NextResponse.json({ sql: sqlQuery })
    const headers = createRateLimitHeaders(rateLimitResult)
    Object.entries(headers).forEach(([key, value]) => {
      response.headers.set(key, value)
    })
    
    return response
  } catch (error: any) {
    console.error('[SQL_GEN_ERROR]', error)
    
    // Don't expose detailed errors in production
    const errorMessage = features.enableDetailedErrors 
      ? error.message || 'Unknown error'
      : 'An error occurred while generating SQL'
    
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}
