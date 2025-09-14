// File: app/api/generate-sql/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { businessPrisma } from '@/lib/mysql-prisma'
import { openai as openaiConfig, features, app } from '@/lib/config'
import { rateLimiters, createRateLimitHeaders, checkRateLimit } from '@/lib/rate-limiter'

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

  // Disallow dangerous keywords
  const banned = /\b(insert|update|delete|merge|create|alter|drop|truncate|grant|revoke|call|use|replace|handler|load|lock|set|show|explain)\b/i
  if (banned.test(sql)) return { ok: false, reason: 'Only read-only SELECT is permitted' }

  // Disallow UNION / WITH (CTE)
  if (/\bunion\b/i.test(sql)) return { ok: false, reason: 'UNION is not allowed' }
  if (/\bwith\b/i.test(sql)) return { ok: false, reason: 'CTEs are not allowed' }

  // Restrict tables to gifts/constituents only (allow subqueries)
  const tableRefs = sql.match(/\bfrom\b|\bjoin\b/gi)
  // Allow subqueries and schema-qualified names
  const badTable = /\b(from|join)\s+(?!\()\s*([`"]?[\w.]+[`"]?)/gi
  let m: RegExpExecArray | null
  while ((m = badTable.exec(sql)) !== null) {
    const raw = (m[2] || '').replace(/[`"]/g, '')
    const t = raw.split('.').pop() // supports schema.table
    if (!/^gifts$|^constituents$/i.test(t || '')) {
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

    // 1. Get database schema information
    const schemaText = `
    Database Schema:
    - gifts table: ACCOUNTID, GIFTID, GIFTDATE, GIFTAMOUNT, TRANSACTIONTYPE, GIFTTYPE, PAYMENTMETHOD, PLEDGEID, SOFTCREDITINDICATOR, SOFTCREDITAMOUNT, SOFTCREDITID, SOURCECODE, DESIGNATION, UNIT, PURPOSECATEGORY, APPEAL, GIVINGLEVEL, UUID
    - constituents table: ACCOUNTID, LOOKUPID, TYPE, DONORTYPE1, ALUMNITYPE, UNDERGRADUATEDEGREE1, UNDERGRADUATIONYEAR1, UNDERGRADUATEPREFERREDCLASSYEAR1, UNDERGRADUATESCHOOL1, GRADUATEDEGREE1, GRADUATEGRADUATIONYEAR1, GRADUATEPREFERREDCLASSYEAR1, GRADUATESCHOOL1, GENDER, DECEASED, SOLICITATIONRESTRICTIONS, DONOTMAIL, DONOTPHONE, DONOTEMAIL, MARRIEDTOALUM, SPOUSELOOKUPID, SPOUSEID, ASSIGNEDACCOUNT, VOLUNTEER, WEALTHSCORE, GEPSTATUS, EVENTSATTENDED, EVENTS, AGE, FULLNAME, PMFULLNAME, FULLADDRESS, HOMETELEPHONE, EMAIL
    
    Table Relationships:
    - gifts.ACCOUNTID = constituents.ACCOUNTID (JOIN key for linking gifts to constituents)
    `;

    // 2. Construct full prompt for SQL generation
    const baseInstruction = `
    You are an assistant that converts natural language questions into SQL queries for a MySQL database.
    Respond ONLY with a single valid SELECT query. No prose, no comments.

    GENERAL RULES:
    - Use SELECT queries only (never INSERT/UPDATE/DELETE).
    - Table aliases: gifts = g, constituents = c.
    - Use INNER JOIN on g.ACCOUNTID = c.ACCOUNTID unless user asks for donors without constituent info (then LEFT JOIN).
    - All column names are UPPERCASE in the schema; use backtick (\`) aliases for human-readable names:
      Example: c.FULLNAME AS \`Full Name\`
    - Always include LIMIT at the end.
    - Never generate multiple statements, UNION, or CTEs (WITH).
    - Never add a semicolon at the end.
    - Single-line comments (-- and #) are allowed for clarity.
    - Use SUM(CAST(g.GIFTAMOUNT AS DECIMAL(15,2))) AS total_amount for donation totals.

    DATE FILTERS:
    - Use sargable ranges instead of YEAR():
      Example: g.GIFTDATE >= '2021-01-01' AND g.GIFTDATE < '2022-01-01'

    AGE HANDLING:
    - Age values may be stored as text, empty, or "0".
    - For display: show Age as
      CASE WHEN CAST(NULLIF(TRIM(c.AGE), '') AS UNSIGNED) > 0
           THEN CAST(NULLIF(TRIM(c.AGE), '') AS UNSIGNED)
           ELSE NULL END AS \`Age\`
    - For sorting: use the same expression in ORDER BY: CAST(NULLIF(TRIM(c.AGE), '') AS UNSIGNED)
    - When ordering by Age, sort with "CAST(NULLIF(TRIM(c.AGE), '') AS UNSIGNED) IS NULL, CAST(NULLIF(TRIM(c.AGE), '') AS UNSIGNED) ASC|DESC" to push unknowns to the end.
    - Do NOT include AgeNum as a separate column in SELECT - it's only for sorting.

    TOP/BOTTOM N LOGIC (MySQL 5.7 Compatible):
    - When the user asks for "top N" or "bottom N":
      1. Use a subquery to get all donors with their totals
      2. Join with constituents to get additional data
      3. Apply ORDER BY total_amount DESC/ASC first, then user's requested sort
      4. Use LIMIT N to get the top/bottom N results
    - This ensures the N donors are chosen by donation amount first, then ordered as requested.
    - Note: ROW_NUMBER() requires MySQL 8.0+, so use ORDER BY + LIMIT for compatibility.

    ORDERING:
    - If the user specifies multiple sorts, the right-most sort in their natural language is the overall sort.
    - Always include tie-breakers: push NULLs last, then sort by Full Name ASC and ACCOUNTID ASC.

    EXAMPLES:

    "top 10 donors of 2021 sorted by age asc":
    SELECT
      c.FULLNAME AS \`Full Name\`,
      CASE WHEN CAST(NULLIF(TRIM(c.AGE), '') AS UNSIGNED) > 0
           THEN CAST(NULLIF(TRIM(c.AGE), '') AS UNSIGNED)
           ELSE NULL END AS \`Age\`,
      dt.total_amount AS \`Total Amount\`
    FROM (
      SELECT
        g.ACCOUNTID,
        SUM(CAST(g.GIFTAMOUNT AS DECIMAL(15,2))) AS total_amount
      FROM gifts g
      WHERE g.GIFTDATE >= '2021-01-01' AND g.GIFTDATE < '2022-01-01'
      GROUP BY g.ACCOUNTID
    ) dt
    INNER JOIN constituents c ON dt.ACCOUNTID = c.ACCOUNTID
    ORDER BY
      dt.total_amount DESC,        -- Primary sort: top donors by amount
      CAST(NULLIF(TRIM(c.AGE), '') AS UNSIGNED) IS NULL,  -- Secondary sort: NULLs last
      CAST(NULLIF(TRIM(c.AGE), '') AS UNSIGNED) ASC,      -- Tertiary sort: age ascending
      c.FULLNAME ASC,              -- Tie-breaker: name
      dt.ACCOUNTID ASC             -- Final tie-breaker: account ID
    LIMIT 10
    `;
    
    const fullSystemPrompt = `${schemaText}\n\n${baseInstruction}`

    const { default: OpenAI } = await import('openai')
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

    // OpenAI call with timeout
    const abort = new AbortController()
    const timer = setTimeout(() => abort.abort(), 15_000)

    const completion = await openai.chat.completions.create({
      model: openaiConfig.model,
      messages: [
        { role: 'system', content: fullSystemPrompt },
        { role: 'user', content: question }
      ],
      max_tokens: 800,
      temperature: 0.1,
    }, { signal: abort.signal }).finally(() => clearTimeout(timer))

    const sqlQuery = completion.choices[0]?.message?.content?.trim()
    
    if (!sqlQuery) {
      return NextResponse.json({ error: 'Failed to generate SQL query' }, { status: 500 })
    }

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
    
    return NextResponse.json({
      error: 'Internal server error',
      message: error.message
    }, { status: 500 })
  }
}