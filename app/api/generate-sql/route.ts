// File: app/api/generate-sql/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { businessPrisma } from '@/lib/mysql-prisma'
import { openai as openaiConfig, features, app } from '@/lib/config'
import { rateLimiters, createRateLimitHeaders, checkRateLimit } from '@/lib/rate-limiter'

// Simple in-memory cache for SQL generation (5 minute TTL)
const queryCache = new Map<string, { sql: string; timestamp: number }>()
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

/**
 * Very strict SQL gate: allow ONLY a single SELECT against gifts/constituents.
 * Blocks semicolons, comments, CTEs, UNION, DML/DDL, multiple statements, etc.
 * Requires a LIMIT (≤ 10000) in the outer query.
 */
function validateSql(sqlRaw: string) {
  const sql = sqlRaw.trim()

  // Single statement, no trailing semicolon
  if (sql.includes(';')) return { ok: false, reason: 'Multiple statements not allowed' }

  // Allow single-line comments (-- and #) but block multi-line comments
  if (/(\/\*|\*\/)/.test(sql)) return { ok: false, reason: 'Multi-line comments are not allowed' }

  // Must start with SELECT (allow leading parentheses for subquery selects)
  if (!/^\s*\(*\s*select\b/i.test(sql)) return { ok: false, reason: 'Only SELECT queries are allowed' }

  // Disallow dangerous keywords (optimized regex)
  if (/\(insert|update|delete|merge|create|alter|drop|truncate|grant|revoke|call|use|replace|handler|load|lock|set|show|explain\)/i.test(sql)) {
    return { ok: false, reason: 'Only read-only SELECT is permitted' }
  }

  // Disallow UNION / WITH (CTE)
  if (/\bunion\b/i.test(sql)) return { ok: false, reason: 'UNION is not allowed' }
  if (/\bwith\b/i.test(sql)) return { ok: false, reason: 'CTEs are not allowed' }

  // Restrict tables to gifts/constituents only (optimized validation)
  const badTable = /\b(from|join)\s+(?!\()\s*([`"]?[\w.]+[`"]?)/gi
  let m: RegExpExecArray | null
  while ((m = badTable.exec(sql)) !== null) {
    const raw = (m[2] || '').replace(/[`"]/g, '')
    const t = raw.split('.').pop() // supports schema.table
    if (t && !/^(gifts|constituents)$/i.test(t)) {
      return { ok: false, reason: `Disallowed table referenced: ${raw}` }
    }
  }

  // Require LIMIT N in the OUTER query and cap it
  const limitMatch = sql.match(/\blimit\s+(\d+)\s*$/i)
  if (!limitMatch) return { ok: false, reason: 'A LIMIT is required on the outer query' }
  const limitVal = parseInt(limitMatch[1], 10)
  if (!(Number.isFinite(limitVal) && limitVal > 0 && limitVal <= 10000)) {
    return { ok: false, reason: 'LIMIT must be between 1 and 10000' }
  }

  return { ok: true as const }
}

export async function POST(req: NextRequest) {
  try {
    // Check if we're in build mode
    if (app.isBuildTime) {
      return NextResponse.json({ error: 'Service unavailable during build' }, { status: 503 })
    }

    // Runtime validation of required environment variables
    if (!process.env.OPENAI_API_KEY || !process.env.BUSINESS_DATABASE_URL || !openaiConfig.model) {
      return NextResponse.json({ 
        error: 'Service configuration error',
        message: 'Required environment variables are not configured'
      }, { status: 500 })
    }

    // Apply rate limiting for AI endpoints (strict limit)
    const rateLimitResult = checkRateLimit(req, 10, 60 * 1000) // 10 requests per minute
    
    if (!rateLimitResult.allowed) {
      return NextResponse.json({
          error: 'Too Many Requests',
          message: 'Rate limit exceeded. Please try again later.',
          retryAfter: Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000),
      }, {
          status: 429,
          headers: {
            ...createRateLimitHeaders(rateLimitResult),
            'Retry-After': Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000).toString(),
        }
      })
    }

    // Parse body safely
    let body: any
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }
    
    const question = body?.question?.toString()?.trim()
    if (!question) {
      return NextResponse.json({ error: 'Missing "question" input' }, { status: 400 })
    }

    // Check cache first (temporarily disabled to ensure updated instructions are used)
    // const cacheKey = question.toLowerCase()
    // const cached = queryCache.get(cacheKey)
    // if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
    //   console.log('🚀 Cache hit for query:', question)
    //   return NextResponse.json({
    //     sql: cached.sql,
    //     results: [], // Cache only stores SQL, not results
    //     success: true,
    //     cached: true
    //   })
    // }

    // 1. Get database schema information
    const schemaText = `
    Database Schema:
    - gifts table: ACCOUNTID, GIFTID, GIFTDATE, GIFTAMOUNT, TRANSACTIONTYPE, GIFTTYPE, PAYMENTMETHOD, PLEDGEID, SOFTCREDITINDICATOR, SOFTCREDITAMOUNT, SOFTCREDITID, SOURCECODE, DESIGNATION, UNIT, PURPOSECATEGORY, APPEAL, GIVINGLEVEL, UUID
    - constituents table: ACCOUNTID, LOOKUPID, TYPE, DONORTYPE1, ALUMNITYPE, UNDERGRADUATEDEGREE1, UNDERGRADUATIONYEAR1, UNDERGRADUATEPREFERREDCLASSYEAR1, UNDERGRADUATESCHOOL1, GRADUATEDEGREE1, GRADUATEGRADUATIONYEAR1, GRADUATEPREFERREDCLASSYEAR1, GRADUATESCHOOL1, GENDER, DECEASED, SOLICITATIONRESTRICTIONS, DONOTMAIL, DONOTPHONE, DONOTEMAIL, MARRIEDTOALUM, SPOUSELOOKUPID, SPOUSEID, ASSIGNEDACCOUNT, VOLUNTEER, WEALTHSCORE, GEPSTATUS, EVENTSATTENDED, EVENTS, AGE, FULLNAME, PMFULLNAME, FULLADDRESS, HOMETELEPHONE, EMAIL
    
    Table Relationships:
    - gifts.ACCOUNTID = constituents.ACCOUNTID (JOIN key for linking gifts to constituents)
    `;

    // 2. Construct optimized prompt for faster SQL generation
    const baseInstruction = `
    Convert natural language to MySQL SELECT query. Respond with ONLY the SQL query, no comments.
    
    CRITICAL RULE: When using subqueries, the main SELECT can ONLY reference:
    - Subquery alias (like dt.column_name) 
    - Main table aliases (like c.column_name)
    - NEVER reference the original subquery table alias (like g.column_name) in the main SELECT

    RULES:
    - Table aliases: gifts=g, constituents=c
    - JOIN: g.ACCOUNTID = c.ACCOUNTID (INNER unless "without constituent info" then LEFT)
    - Column aliases: c.FULLNAME AS \`Full Name\`
    - Always LIMIT at end
    - No semicolons, UNION, CTEs, or multiple statements
    - Dates: g.GIFTDATE >= '2021-01-01' AND g.GIFTDATE < '2022-01-01'
    - Age: CASE WHEN CAST(NULLIF(TRIM(c.AGE), '') AS UNSIGNED) > 0 THEN CAST(NULLIF(TRIM(c.AGE), '') AS UNSIGNED) ELSE NULL END AS \`Age\`
    - Totals: SUM(CAST(g.GIFTAMOUNT AS DECIMAL(15,2))) AS total_amount
    - Top N: subquery with totals, then ORDER BY user_sort, LIMIT N
    - For "top N sorted by X": Sort by X, then take top N results
    - Tie-breakers: NULLs last, then FULLNAME ASC, ACCOUNTID ASC
    - CRITICAL: In main SELECT after subquery, NEVER use 'g.' prefix. Only use 'dt.' and 'c.' aliases. The 'g' alias only exists inside the subquery.

    EXAMPLE - "top 10 donors of 2021 sorted by age asc":
    SELECT c.FULLNAME AS \`Full Name\`, 
           CASE WHEN CAST(NULLIF(TRIM(c.AGE), '') AS UNSIGNED) > 0 THEN CAST(NULLIF(TRIM(c.AGE), '') AS UNSIGNED) ELSE NULL END AS \`Age\`,
           dt.total_amount AS \`Total Amount\`
    FROM (SELECT g.ACCOUNTID, SUM(CAST(g.GIFTAMOUNT AS DECIMAL(15,2))) AS total_amount FROM gifts g WHERE g.GIFTDATE >= '2021-01-01' AND g.GIFTDATE < '2022-01-01' GROUP BY g.ACCOUNTID) dt
    INNER JOIN constituents c ON dt.ACCOUNTID = c.ACCOUNTID
    ORDER BY CAST(NULLIF(TRIM(c.AGE), '') AS UNSIGNED) IS NULL, CAST(NULLIF(TRIM(c.AGE), '') AS UNSIGNED) ASC, c.FULLNAME ASC, dt.ACCOUNTID ASC
    LIMIT 10
    
    NOTE: Only use table aliases that are available in the current query scope. In subqueries, use the subquery alias (dt) not the original table alias (g).
    
    WRONG: SELECT g.GIFTDATE FROM (...) dt  -- g alias not available in main query
    RIGHT: SELECT dt.total_amount FROM (...) dt  -- dt alias is available
    
    If you need gift date in results, include it in subquery:
    FROM (SELECT g.ACCOUNTID, g.GIFTDATE, SUM(...) AS total_amount FROM gifts g ...) dt
    Then use: dt.GIFTDATE in main SELECT
    `;
    
    const fullSystemPrompt = `${schemaText}\n\n${baseInstruction}`

    const { default: OpenAI } = await import('openai')
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

    // OpenAI call with timeout (increased for complex queries)
    const abort = new AbortController()
    const timer = setTimeout(() => abort.abort(), 15_000)

    const completion = await openai.chat.completions.create({
      model: openaiConfig.model,
      messages: [
        { role: 'system', content: fullSystemPrompt },
        { role: 'user', content: question }
      ],
      max_tokens: 600,
      temperature: 0.2,
    }, { signal: abort.signal }).finally(() => clearTimeout(timer))

    const sqlQuery = completion.choices[0]?.message?.content?.trim()
    
    if (!sqlQuery) {
      return NextResponse.json({ error: 'Failed to generate SQL query' }, { status: 500 })
    }

    // Store in cache for future use (temporarily disabled)
    // const cacheKey = question.toLowerCase()
    // queryCache.set(cacheKey, { sql: sqlQuery, timestamp: Date.now() })
    
    // Clean up old cache entries (keep cache size reasonable)
    // if (queryCache.size > 100) {
    //   const now = Date.now()
    //   for (const [key, value] of queryCache.entries()) {
    //     if (now - value.timestamp > CACHE_TTL) {
    //       queryCache.delete(key)
    //     }
    //   }
    // }

    // Validate SQL before executing
    const validation = validateSql(sqlQuery)
    if (!validation.ok) {
      return NextResponse.json({
        error: 'SQL validation failed',
        reason: (validation as any).reason,
        sql: sqlQuery,
        success: false
      }, { status: 400 })
    }

    // 3. Execute the generated SQL query
    try {
      const results = await businessPrisma.$queryRawUnsafe(sqlQuery)
      
      // Convert BigInt values to strings to prevent serialization errors
      const serializedResults = JSON.parse(JSON.stringify(results, (key, value) =>
        typeof value === 'bigint' ? value.toString() : value
      ))
      
      return NextResponse.json({
        sql: sqlQuery,
        results: serializedResults,
        success: true
      })
    } catch (sqlError: any) {
      console.error('🔴 SQL execution error:', sqlError)
      console.error('🔴 SQL query that failed:', sqlQuery)
      
      return NextResponse.json({
        error: 'SQL execution failed',
        message: sqlError?.message ?? 'Unknown SQL error',
        sql: sqlQuery,
        success: false,
        details: {
          code: sqlError?.code,
          errno: sqlError?.errno,
          sqlState: sqlError?.sqlState,
          sqlMessage: sqlError?.sqlMessage
        }
      }, { status: 400 })
    }

  } catch (error: any) {
    console.error('Generate SQL error:', error)
    
    // Handle timeout specifically
    if (error.name === 'AbortError' || error.message.includes('aborted')) {
      return NextResponse.json({
        error: 'Request timeout',
        message: 'SQL generation took too long. Please try a simpler query or try again.',
        success: false
      }, { status: 408 })
    }
    
    return NextResponse.json({
      error: 'Internal server error',
      message: error.message
    }, { status: 500 })
  }
}