// File: app/api/generate-sql/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { businessPrisma } from '@/lib/mysql-prisma'
import { openai as openaiConfig, features, app } from '@/lib/config'
import { rateLimiters, createRateLimitHeaders, checkRateLimit } from '@/lib/rate-limiter'

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
    - constituents table: id, ACCOUNTID, LOOKUPID, TYPE, DONORTYPE1, PERSONORGANIZATIONINDICATOR, ALUMNITYPE, UNDERGRADUATEDEGREE1, UNDERGRADUATIONYEAR1, UNDERGRADUATEPREFERREDCLASSYEAR1, UNDERGRADUATESCHOOL1, UNDERGRADUATEDEGREE2, UNDERGRADUATEGRADUATIONYEAR2, UNDERGRADUATEPREFERREDCLASSYEAR2, UNDERGRADUATESCHOOL2, GRADUATEDEGREE1, GRADUATEGRADUATIONYEAR1, GRADUATEPREFERREDCLASSYEAR1, GRADUATESCHOOL1, GRADUATEDEGREE2, GRADUATEGRADUATIONYEAR2, GRADUATEPREFERREDCLASSYEAR2, GRADUATESCHOOL2, GENDER, DECEASED, SOLICITATIONRESTRICTIONS, DONOTMAIL, DONOTPHONE, DONOTEMAIL, MARRIEDTOALUM, SPOUSELOOKUPID, SPOUSEID, ASSIGNEDACCOUNT, VOLUNTEER, WEALTHSCORE, GEPSTATUS, EVENTSATTENDED, EVENTS, AGE, GUID, FULLNAME, PMFULLNAME, FULLADDRESS, HOMETELEPHONE, EMAIL
    
    Table Relationships:
    - gifts.ACCOUNTID = constituents.ACCOUNTID (JOIN key for linking gifts to constituents)
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
    - constituents table: id, ACCOUNTID, LOOKUPID, TYPE, DONORTYPE1, PERSONORGANIZATIONINDICATOR, ALUMNITYPE, UNDERGRADUATEDEGREE1, UNDERGRADUATIONYEAR1, UNDERGRADUATEPREFERREDCLASSYEAR1, UNDERGRADUATESCHOOL1, UNDERGRADUATEDEGREE2, UNDERGRADUATEGRADUATIONYEAR2, UNDERGRADUATEPREFERREDCLASSYEAR2, UNDERGRADUATESCHOOL2, GRADUATEDEGREE1, GRADUATEGRADUATIONYEAR1, GRADUATEPREFERREDCLASSYEAR1, GRADUATESCHOOL1, GRADUATEDEGREE2, GRADUATEGRADUATIONYEAR2, GRADUATEPREFERREDCLASSYEAR2, GRADUATESCHOOL2, GENDER, DECEASED, SOLICITATIONRESTRICTIONS, DONOTMAIL, DONOTPHONE, DONOTEMAIL, MARRIEDTOALUM, SPOUSELOOKUPID, SPOUSEID, ASSIGNEDACCOUNT, VOLUNTEER, WEALTHSCORE, GEPSTATUS, EVENTSATTENDED, EVENTS, AGE, GUID, FULLNAME, PMFULLNAME, FULLADDRESS, HOMETELEPHONE, EMAIL
    
    Table Relationships:
    - gifts.ACCOUNTID = constituents.ACCOUNTID (JOIN key for linking gifts to constituents)

    Common patterns:
    - For "top donors": SELECT g.*, c.FULLNAME, c.EMAIL, SUM(CAST(g.GIFTAMOUNT AS DECIMAL(15,2))) as totalAmount FROM gifts g JOIN constituents c ON g.ACCOUNTID = c.ACCOUNTID GROUP BY g.ACCOUNTID, c.FULLNAME ORDER BY totalAmount DESC LIMIT 10
    - For "gifts by donor": SELECT g.*, c.FULLNAME, c.EMAIL FROM gifts g JOIN constituents c ON g.ACCOUNTID = c.ACCOUNTID WHERE c.FULLNAME = 'Donor Name' LIMIT 100
    - For "alumni donors": SELECT g.*, c.FULLNAME, c.ALUMNITYPE, c.UNDERGRADUATEDEGREE1 FROM gifts g JOIN constituents c ON g.ACCOUNTID = c.ACCOUNTID WHERE c.ALUMNITYPE IS NOT NULL LIMIT 50
    - For "donors by gender": SELECT c.GENDER, c.FULLNAME, SUM(CAST(g.GIFTAMOUNT AS DECIMAL(15,2))) as totalAmount FROM gifts g JOIN constituents c ON g.ACCOUNTID = c.ACCOUNTID GROUP BY c.GENDER, c.FULLNAME ORDER BY totalAmount DESC LIMIT 25
    - For "donors by age": SELECT c.AGE, c.FULLNAME, AVG(CAST(g.GIFTAMOUNT AS DECIMAL(15,2))) as avgAmount FROM gifts g JOIN constituents c ON g.ACCOUNTID = c.ACCOUNTID GROUP BY c.AGE, c.FULLNAME ORDER BY avgAmount DESC LIMIT 25
    - For "volunteer donors": SELECT g.*, c.FULLNAME, c.VOLUNTEER FROM gifts g JOIN constituents c ON g.ACCOUNTID = c.ACCOUNTID WHERE c.VOLUNTEER = 'Yes' LIMIT 50
    - For "high wealth donors": SELECT g.*, c.FULLNAME, c.WEALTHSCORE FROM gifts g JOIN constituents c ON g.ACCOUNTID = c.ACCOUNTID WHERE c.WEALTHSCORE > 50 LIMIT 50
    - For "gifts by source": SELECT g.SOURCECODE, COUNT(*) as giftCount, SUM(CAST(g.GIFTAMOUNT AS DECIMAL(15,2))) as totalAmount FROM gifts g JOIN constituents c ON g.ACCOUNTID = c.ACCOUNTID GROUP BY g.SOURCECODE ORDER BY totalAmount DESC LIMIT 20
    - For "gifts by designation": SELECT g.DESIGNATION, COUNT(*) as giftCount, SUM(CAST(g.GIFTAMOUNT AS DECIMAL(15,2))) as totalAmount FROM gifts g JOIN constituents c ON g.ACCOUNTID = c.ACCOUNTID GROUP BY g.DESIGNATION ORDER BY totalAmount DESC LIMIT 20

    JOIN Guidelines:
    - When queries involve donor/constituent information, use JOIN to connect gifts and constituents tables
    - Use table aliases: 'g' for gifts, 'c' for constituents
    - JOIN syntax: FROM gifts g JOIN constituents c ON g.ACCOUNTID = c.ACCOUNTID
    - Include relevant constituent fields like c.FULLNAME, c.EMAIL, c.GENDER, c.AGE, c.ALUMNITYPE etc. in SELECT
    - Group by both g.ACCOUNTID and relevant constituent fields when aggregating by donor
    - Use constituent fields for filtering: c.FULLNAME, c.GENDER, c.AGE, c.ALUMNITYPE, c.VOLUNTEER, c.WEALTHSCORE etc.
    - ALWAYS include LIMIT clause to prevent slow queries (default LIMIT 50 for detail queries, LIMIT 20 for aggregations)
    - For large result sets, use WHERE clauses to filter data before JOINing
    - When grouping, select only necessary fields to improve performance

    Performance Guidelines:
    - Always include LIMIT clause (typically 10-100 depending on query type)
    - Use specific WHERE clauses to filter data before JOINing when possible
    - For aggregations, limit GROUP BY fields to essential ones only
    - Prefer filtering on indexed fields (ACCOUNTID, FULLNAME, common demographics)

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
