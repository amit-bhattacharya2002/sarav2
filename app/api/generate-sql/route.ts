// // File: app/api/generate-sql/route.ts
// import { NextRequest, NextResponse } from 'next/server'
// import { businessPrisma } from '@/lib/mysql-prisma'
// import { openai as openaiConfig, features, app } from '@/lib/config'
// import { rateLimiters, createRateLimitHeaders, checkRateLimit } from '@/lib/rate-limiter'

// // Runtime configuration for better performance
// export const runtime = 'nodejs'
// export const maxDuration = 60
// export const dynamic = 'force-dynamic'

// // Simple in-memory cache for SQL generation (5 minute TTL)
// const queryCache = new Map<string, { sql: string; timestamp: number }>()
// const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

// /**
//  * Very strict SQL gate: allow ONLY a single SELECT against gifts/constituents.
//  * Blocks semicolons, comments, CTEs, UNION, DML/DDL, multiple statements, etc.
//  * Requires a LIMIT (≤ 10000) in the outer query.
//  */
// function validateSql(sqlRaw: string) {
//   const sql = sqlRaw.trim()

//   // Single statement, no trailing semicolon
//   if (sql.includes(';')) return { ok: false, reason: 'Multiple statements not allowed' }

//   // Block all comments (single-line and multi-line)
//   if (/(--|#|\/\*)/.test(sql)) return { ok: false, reason: 'Comments are not allowed' }

//   // Must start with SELECT (allow leading parentheses for subquery selects)
//   if (!/^\s*\(*\s*select\b/i.test(sql)) return { ok: false, reason: 'Only SELECT queries are allowed' }

//   // Disallow dangerous keywords (optimized regex with word boundaries)
//   if (/\b(insert|update|delete|merge|create|alter|drop|truncate|grant|revoke|call|use|replace|handler|load|lock|set|show|explain)\b/i.test(sql)) {
//     return { ok: false, reason: 'Only read-only SELECT is permitted' }
//   }

//   // Disallow UNION / WITH (CTE)
//   if (/\bunion\b/i.test(sql)) return { ok: false, reason: 'UNION is not allowed' }
//   if (/\bwith\b/i.test(sql)) return { ok: false, reason: 'CTEs are not allowed' }

//   // Restrict tables to gifts/constituents only (optimized validation)
//   const badTable = /\b(from|join)\s+(?!\()\s*([`"]?[\w.]+[`"]?)/gi
//   let m: RegExpExecArray | null
//   while ((m = badTable.exec(sql)) !== null) {
//     const raw = (m[2] || '').replace(/[`"]/g, '')
//     const t = raw.split('.').pop() // supports schema.table
//     if (t && !/^(gifts|constituents)$/i.test(t)) {
//       return { ok: false, reason: `Disallowed table referenced: ${raw}` }
//     }
//   }

//   // Require LIMIT N in the OUTER query and cap it
//   const limitMatch = sql.match(/\blimit\s+(\d+)\s*$/i)
//   if (!limitMatch) return { ok: false, reason: 'A LIMIT is required on the outer query' }
//   const limitVal = parseInt(limitMatch[1], 10)
//   if (!(Number.isFinite(limitVal) && limitVal > 0 && limitVal <= 10000)) {
//     return { ok: false, reason: 'LIMIT must be between 1 and 10000' }
//   }

//   return { ok: true as const }
// }

// export async function POST(req: NextRequest) {
//   try {
//     // Check if we're in build mode
//     if (app.isBuildTime) {
//       return NextResponse.json({ error: 'Service unavailable during build' }, { status: 503 })
//     }

//     // Runtime validation of required environment variables
//     if (!process.env.OPENAI_API_KEY || !process.env.BUSINESS_DATABASE_URL || !openaiConfig.model) {
//       return NextResponse.json({ 
//         error: 'Service configuration error',
//         message: 'Required environment variables are not configured'
//       }, { status: 500 })
//     }

//     // Apply rate limiting for AI endpoints (strict limit)
//     const rateLimitResult = checkRateLimit(req, 10, 60 * 1000) // 10 requests per minute
    
//     if (!rateLimitResult.allowed) {
//       return NextResponse.json({
//           error: 'Too Many Requests',
//           message: 'Rate limit exceeded. Please try again later.',
//           retryAfter: Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000),
//       }, {
//           status: 429,
//           headers: {
//             ...createRateLimitHeaders(rateLimitResult),
//             'Retry-After': Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000).toString(),
//         }
//       })
//     }

//     // Parse body safely
//     let body: any
//     try {
//       body = await req.json()
//     } catch {
//       return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
//     }
    
//     const question = body?.question?.toString()?.trim()
//     if (!question) {
//       return NextResponse.json({ error: 'Missing "question" input' }, { status: 400 })
//     }

//     // Check cache first
//     const cacheKey = question.toLowerCase()
//     const cached = queryCache.get(cacheKey)
//     if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
//       console.log('🚀 Cache hit for query:', question)
//       return NextResponse.json({
//         sql: cached.sql,
//         results: [], // Cache only stores SQL, not results
//         success: true,
//         cached: true
//       })
//     }

//     // Fast path for simple "top N donors of year" queries (no LLM needed)
//     const simpleTopDonorsMatch = question.match(/top\s+(\d+)\s+donors?\s+of\s+(\d{4})/i)
//     if (simpleTopDonorsMatch && !question.includes('sort') && !question.includes('age') && !question.includes('gift date')) {
//       const [, limit, year] = simpleTopDonorsMatch
//       const sqlQuery = `SELECT c.FULLNAME AS \`Full Name\`,
//        dt.total_amount AS \`Total Amount\`
// FROM (
//   SELECT g.ACCOUNTID,
//          SUM(CAST(g.GIFTAMOUNT AS DECIMAL(15,2))) AS total_amount
//   FROM gifts g
//   WHERE g.GIFTDATE >= '${year}-01-01' AND g.GIFTDATE < '${parseInt(year) + 1}-01-01'
//   GROUP BY g.ACCOUNTID
//   ORDER BY total_amount DESC
//   LIMIT ${limit}
// ) dt
// LEFT JOIN constituents c ON c.ACCOUNTID = dt.ACCOUNTID
// ORDER BY dt.total_amount DESC, c.FULLNAME ASC, dt.ACCOUNTID ASC
// LIMIT ${limit}`
      
//       console.log('⚡ Fast path SQL generated for:', question)
      
//       // Store in cache
//       queryCache.set(cacheKey, { sql: sqlQuery, timestamp: Date.now() })
      
//       return NextResponse.json({ sql: sqlQuery, success: true, fastPath: true })
//     }

//     // 1. Get database schema information
//     const schemaText = `
//     Database Schema:
//     - gifts table: ACCOUNTID, GIFTID, GIFTDATE, GIFTAMOUNT, TRANSACTIONTYPE, GIFTTYPE, PAYMENTMETHOD, PLEDGEID, SOFTCREDITINDICATOR, SOFTCREDITAMOUNT, SOFTCREDITID, SOURCECODE, DESIGNATION, UNIT, PURPOSECATEGORY, APPEAL, GIVINGLEVEL, UUID
//     - constituents table: ACCOUNTID, LOOKUPID, TYPE, DONORTYPE1, ALUMNITYPE, UNDERGRADUATEDEGREE1, UNDERGRADUATIONYEAR1, UNDERGRADUATEPREFERREDCLASSYEAR1, UNDERGRADUATESCHOOL1, GRADUATEDEGREE1, GRADUATEGRADUATIONYEAR1, GRADUATEPREFERREDCLASSYEAR1, GRADUATESCHOOL1, GENDER, DECEASED, SOLICITATIONRESTRICTIONS, DONOTMAIL, DONOTPHONE, DONOTEMAIL, MARRIEDTOALUM, SPOUSELOOKUPID, SPOUSEID, ASSIGNEDACCOUNT, VOLUNTEER, WEALTHSCORE, GEPSTATUS, EVENTSATTENDED, EVENTS, AGE, FULLNAME, PMFULLNAME, FULLADDRESS, HOMETELEPHONE, EMAIL
    
//     Table Relationships:
//     - gifts.ACCOUNTID = constituents.ACCOUNTID (JOIN key for linking gifts to constituents)
//     `;

//     // 2. Construct optimized prompt for faster SQL generation
//     const baseInstruction = `
// Convert natural language to ONE MariaDB 10.11 SELECT. Output ONLY SQL, no comments/semicolons.

// Tables: gifts g, constituents c. Use LEFT JOIN on g.ACCOUNTID = c.ACCOUNTID to preserve all donors.
// Use backticks for human aliases (e.g., c.FULLNAME AS \`Full Name\`). End with LIMIT.

// Dates:
// - Year Y → g.GIFTDATE >= 'Y-01-01' AND g.GIFTDATE < 'Y+1-01-01'
// - If range provided use it; else no date filter.

// Totals: SUM(CAST(g.GIFTAMOUNT AS DECIMAL(15,2))) AS total_amount.

// Age display/sort:
// - Display:
//   CASE WHEN CAST(NULLIF(TRIM(c.AGE), '') AS UNSIGNED) > 0 THEN CAST(NULLIF(TRIM(c.AGE), '') AS UNSIGNED) ELSE NULL END AS \`Age\`
// - If sorting by Age, also include:
//   CAST(NULLIF(TRIM(c.AGE), '') AS UNSIGNED) AS AgeNum
//   and order: AgeNum IS NULL, AgeNum {ASC|DESC}. Only include AgeNum when sorting by Age.

// Gift date in results (if asked):
// - Use MAX(g.GIFTDATE) AS last_gift_date (or MIN for earliest) inside the totals subquery and reference dt.last_gift_date.

// Top/Bottom donors (two-phase):
// - In a subquery: GROUP BY g.ACCOUNTID, compute total_amount (+ any date aggregates), add ROW_NUMBER() OVER (ORDER BY total_amount DESC for top, ASC for bottom) AS rn.
// - Outer: LEFT JOIN to c, WHERE rn <= N, THEN apply the overall (right-most) user sort.
// - Use LEFT JOIN to preserve all donors even if they lack constituent data.
// - Tie-breakers: c.FULLNAME ASC, ACCOUNTID ASC.

// Example ("top 10 donors of 2021 include last gift date, sorted by age asc"):
// SELECT c.FULLNAME AS \`Full Name\`,
//        CASE WHEN CAST(NULLIF(TRIM(c.AGE), '') AS UNSIGNED) > 0 THEN CAST(NULLIF(TRIM(c.AGE), '') AS UNSIGNED) ELSE NULL END AS \`Age\`,
//        dt.total_amount AS \`Total Amount\`,
//        dt.last_gift_date AS \`Last Gift Date\`,
//        CAST(NULLIF(TRIM(c.AGE), '') AS UNSIGNED) AS AgeNum
// FROM (
//   SELECT g.ACCOUNTID,
//          SUM(CAST(g.GIFTAMOUNT AS DECIMAL(15,2))) AS total_amount,
//          MAX(g.GIFTDATE) AS last_gift_date,
//          ROW_NUMBER() OVER (ORDER BY SUM(CAST(g.GIFTAMOUNT AS DECIMAL(15,2))) DESC) AS rn
//   FROM gifts g
//   WHERE g.GIFTDATE >= '2021-01-01' AND g.GIFTDATE < '2022-01-01'
//   GROUP BY g.ACCOUNTID
// ) dt
// LEFT JOIN constituents c ON dt.ACCOUNTID = c.ACCOUNTID
// WHERE dt.rn <= 10
// ORDER BY AgeNum IS NULL, AgeNum ASC, c.FULLNAME ASC, dt.ACCOUNTID ASC
// LIMIT 10
//     `;
    
//     const fullSystemPrompt = `${schemaText}\n\n${baseInstruction}`

//     const { default: OpenAI } = await import('openai')
//     const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

//     // OpenAI call with optimized parameters for speed
//     const abort = new AbortController()
//     const timer = setTimeout(() => abort.abort(), 45_000) // Increased timeout to 45s

//     const completion = await openai.chat.completions.create({
//       model: openaiConfig.model,
//       messages: [
//         { role: 'system', content: fullSystemPrompt },
//         { role: 'user', content: question }
//       ],
//       max_tokens: 300, // Reduced for faster generation
//       temperature: 0.1, // Lower for more consistent results
//     }, { signal: abort.signal, timeout: 45000 }).finally(() => clearTimeout(timer))

//     const sqlQuery = completion.choices[0]?.message?.content?.trim()
    
//     if (!sqlQuery) {
//       return NextResponse.json({ error: 'Failed to generate SQL query' }, { status: 500 })
//     }

//     // Store in cache for future use
//     queryCache.set(cacheKey, { sql: sqlQuery, timestamp: Date.now() })
    
//     // Clean up old cache entries (keep cache size reasonable)
//     if (queryCache.size > 100) {
//       const now = Date.now()
//       for (const [key, value] of queryCache.entries()) {
//         if (now - value.timestamp > CACHE_TTL) {
//           queryCache.delete(key)
//         }
//       }
//     }

//     // Validate SQL before executing
//     const validation = validateSql(sqlQuery)
//     if (!validation.ok) {
//       return NextResponse.json({
//         error: 'SQL validation failed',
//         reason: (validation as any).reason,
//         sql: sqlQuery,
//         success: false
//       }, { status: 400 })
//     }

//     // 3. Execute the generated SQL query
//     try {
//       const results = await businessPrisma.$queryRawUnsafe(sqlQuery)
      
//       // Convert BigInt values to strings to prevent serialization errors
//       const serializedResults = JSON.parse(JSON.stringify(results, (key, value) =>
//         typeof value === 'bigint' ? value.toString() : value
//       ))
      
//       return NextResponse.json({
//         sql: sqlQuery,
//         results: serializedResults,
//         success: true
//       })
//     } catch (sqlError: any) {
//       console.error('🔴 SQL execution error:', sqlError)
//       console.error('🔴 SQL query that failed:', sqlQuery)
      
//       return NextResponse.json({
//         error: 'SQL execution failed',
//         message: sqlError?.message ?? 'Unknown SQL error',
//         sql: sqlQuery,
//         success: false,
//         details: {
//           code: sqlError?.code,
//           errno: sqlError?.errno,
//           sqlState: sqlError?.sqlState,
//           sqlMessage: sqlError?.sqlMessage
//         }
//       }, { status: 400 })
//     }

//   } catch (error: any) {
//     console.error('Generate SQL error:', error)
    
//     // Handle timeout specifically
//     if (error.name === 'AbortError' || error.message.includes('aborted')) {
//       return NextResponse.json({
//         error: 'Request timeout',
//         message: 'SQL generation took too long. Please try a simpler query or try again.',
//         success: false
//       }, { status: 408 })
//     }
    
//     return NextResponse.json({
//       error: 'Internal server error',
//       message: error.message
//     }, { status: 500 })
//   }
// }



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
    IMPORTANT: Prioritize relevant columns first and use aliases for better readability.
    Respond ONLY with valid SQL query code — no explanation.

    Database Schema:
    - gifts table: id, ACCOUNTID, GIFTID, GIFTDATE, GIFTAMOUNT, TRANSACTIONTYPE, GIFTTYPE, PAYMENTMETHOD, PLEDGEID, SOFTCREDITINDICATOR, SOFTCREDITAMOUNT, SOFTCREDITID, SOURCECODE, DESIGNATION, UNIT, PURPOSECATEGORY, APPEAL, GIVINGLEVEL, UUID
    - constituents table: id, ACCOUNTID, LOOKUPID, TYPE, DONORTYPE1, PERSONORGANIZATIONINDICATOR, ALUMNITYPE, UNDERGRADUATEDEGREE1, UNDERGRADUATIONYEAR1, UNDERGRADUATEPREFERREDCLASSYEAR1, UNDERGRADUATESCHOOL1, UNDERGRADUATEDEGREE2, UNDERGRADUATEGRADUATIONYEAR2, UNDERGRADUATEPREFERREDCLASSYEAR2, UNDERGRADUATESCHOOL2, GRADUATEDEGREE1, GRADUATEGRADUATIONYEAR1, GRADUATEPREFERREDCLASSYEAR1, GRADUATESCHOOL1, GRADUATEDEGREE2, GRADUATEGRADUATIONYEAR2, GRADUATEPREFERREDCLASSYEAR2, GRADUATESCHOOL2, GENDER, DECEASED, SOLICITATIONRESTRICTIONS, DONOTMAIL, DONOTPHONE, DONOTEMAIL, MARRIEDTOALUM, SPOUSELOOKUPID, SPOUSEID, ASSIGNEDACCOUNT, VOLUNTEER, WEALTHSCORE, GEPSTATUS, EVENTSATTENDED, EVENTS, AGE, GUID, FULLNAME, PMFULLNAME, FULLADDRESS, HOMETELEPHONE, EMAIL
    
    Table Relationships:
    - gifts.ACCOUNTID = constituents.ACCOUNTID (JOIN key for linking gifts to constituents)

    COLUMN ORDERING AND ALIASING GUIDELINES:
    - CRITICAL: Always use human-readable aliases for ALL columns with proper spacing and capitalization
    - For donor queries: Put donor name (c.FULLNAME) FIRST, then donation amount, then year/date
    - For top donor queries: c.FULLNAME as "Donor Name", SUM(CAST(g.GIFTAMOUNT AS DECIMAL(15,2))) as "Total Amount", YEAR(g.GIFTDATE) as "Year"
    - For gift analysis: c.FULLNAME as "Donor Name", g.GIFTAMOUNT as "Donation Amount", g.GIFTDATE as "Gift Date"
    - For year-specific queries: Include YEAR(g.GIFTDATE) as "Year" in the SELECT
    - Use meaningful aliases: "Donor Name", "Donation Amount", "Total Amount", "Year", "Gift Date", "Source", "Designation"
    - Always include the most relevant information first in the SELECT clause
    
    MANDATORY ALIAS MAPPINGS - Use these exact aliases for better readability:
    IMPORTANT: Use the actual database column names (in UPPERCASE) with these aliases:
    - g.ACCOUNTID as 'Account ID'
    - g.GIFTID as 'Gift ID'
    - g.GIFTDATE as 'Gift Date'
    - g.GIFTAMOUNT as 'Gift Amount'
    - g.TRANSACTIONTYPE as 'Transaction Type'
    - g.GIFTTYPE as 'Gift Type'
    - g.PAYMENTMETHOD as 'Payment Method'
    - g.PLEDGEID as 'Pledge ID'
    - g.SOFTCREDITINDICATOR as 'Soft Credit Indicator'
    - g.SOFTCREDITAMOUNT as 'Soft Credit Amount'
    - g.SOFTCREDITID as 'Soft Credit ID'
    - g.SOURCECODE as 'Source Code'
    - g.DESIGNATION as 'Designation'
    - g.UNIT as 'Unit'
    - g.PURPOSECATEGORY as 'Purpose Category'
    - g.APPEAL as 'Appeal'
    - g.GIVINGLEVEL as 'Giving Level'
    - c.LOOKUPID as 'Lookup ID'
    - c.TYPE as 'Type'
    - c.DONORTYPE1 as 'Donor Type'
    - c.PERSONORGANIZATIONINDICATOR as 'Person Organization Indicator'
    - c.ALUMNITYPE as 'Alumni Type'
    - c.UNDERGRADUATEDEGREE1 as 'Undergraduate Degree'
    - c.UNDERGRADUATIONYEAR1 as 'Undergraduate Year'
    - c.UNDERGRADUATEPREFERREDCLASSYEAR1 as 'Undergraduate Preferred Class Year'
    - c.UNDERGRADUATESCHOOL1 as 'Undergraduate School'
    - c.GRADUATEDEGREE1 as 'Graduate Degree'
    - c.GRADUATEGRADUATIONYEAR1 as 'Graduate Graduation Year'
    - c.GRADUATEPREFERREDCLASSYEAR1 as 'Graduate Preferred Class Year'
    - c.GRADUATESCHOOL1 as 'Graduate School'
    - c.GENDER as 'Gender'
    - c.DECEASED as 'Deceased'
    - c.SOLICITATIONRESTRICTIONS as 'Solicitation Restrictions'
    - c.DONOTMAIL as 'Do Not Mail'
    - c.DONOTPHONE as 'Do Not Phone'
    - c.DONOTEMAIL as 'Do Not Email'
    - c.MARRIEDTOALUM as 'Married To Alum'
    - c.SPOUSELOOKUPID as 'Spouse Lookup ID'
    - c.SPOUSEID as 'Spouse ID'
    - c.ASSIGNEDACCOUNT as 'Assigned Account'
    - c.VOLUNTEER as 'Volunteer'
    - c.WEALTHSCORE as 'Wealth Score'
    - c.GEPSTATUS as 'GEP Status'
    - c.EVENTSATTENDED as 'Events Attended'
    - c.EVENTS as 'Events'
    - c.AGE as 'Age'
    - c.FULLNAME as 'Full Name'
    - c.PMFULLNAME as 'PM Full Name'
    - c.FULLADDRESS as 'Full Address'
    - c.HOMETELEPHONE as 'Home Telephone'
    - c.EMAIL as 'Email'

    Common patterns with proper column ordering:
    - For "top donors" (ascending): SELECT c.FULLNAME as 'Full Name', SUM(CAST(g.GIFTAMOUNT AS DECIMAL(15,2))) as 'Total Amount', YEAR(g.GIFTDATE) as 'Year', g.GIFTID as 'Gift ID', g.GIFTDATE as 'Gift Date', g.GIFTAMOUNT as 'Gift Amount', g.PAYMENTMETHOD as 'Payment Method', g.PLEDGEID as 'Pledge ID', g.SOFTCREDITINDICATOR as 'Soft Credit Indicator', g.SOFTCREDITAMOUNT as 'Soft Credit Amount', g.SOFTCREDITID as 'Soft Credit ID', g.SOURCECODE as 'Source Code', g.DESIGNATION as 'Designation', c.EMAIL as 'Email' FROM gifts g JOIN constituents c ON g.ACCOUNTID = c.ACCOUNTID GROUP BY g.ACCOUNTID, c.FULLNAME ORDER BY SUM(CAST(g.GIFTAMOUNT AS DECIMAL(15,2))) DESC LIMIT 10
    - For "top donors" (descending): SELECT c.FULLNAME as 'Full Name', SUM(CAST(g.GIFTAMOUNT AS DECIMAL(15,2))) as 'Total Amount', YEAR(g.GIFTDATE) as 'Year', g.GIFTID as 'Gift ID', g.GIFTDATE as 'Gift Date', g.GIFTAMOUNT as 'Gift Amount', g.PAYMENTMETHOD as 'Payment Method', g.PLEDGEID as 'Pledge ID', g.SOFTCREDITINDICATOR as 'Soft Credit Indicator', g.SOFTCREDITAMOUNT as 'Soft Credit Amount', g.SOFTCREDITID as 'Soft Credit ID', g.SOURCECODE as 'Source Code', g.DESIGNATION as 'Designation', c.EMAIL as 'Email' FROM gifts g JOIN constituents c ON g.ACCOUNTID = c.ACCOUNTID GROUP BY g.ACCOUNTID, c.FULLNAME ORDER BY SUM(CAST(g.GIFTAMOUNT AS DECIMAL(15,2))) DESC LIMIT 10
    - For "top donors by year" (ascending): SELECT c.FULLNAME as 'Full Name', SUM(CAST(g.GIFTAMOUNT AS DECIMAL(15,2))) as 'Total Amount', YEAR(g.GIFTDATE) as 'Year', g.GIFTID as 'Gift ID', g.GIFTDATE as 'Gift Date', g.GIFTAMOUNT as 'Gift Amount', g.PAYMENTMETHOD as 'Payment Method', g.PLEDGEID as 'Pledge ID', g.SOFTCREDITINDICATOR as 'Soft Credit Indicator', g.SOFTCREDITAMOUNT as 'Soft Credit Amount', g.SOFTCREDITID as 'Soft Credit ID', g.SOURCECODE as 'Source Code', g.DESIGNATION as 'Designation', c.EMAIL as 'Email' FROM gifts g JOIN constituents c ON g.ACCOUNTID = c.ACCOUNTID WHERE YEAR(g.GIFTDATE) = [YEAR] GROUP BY g.ACCOUNTID, c.FULLNAME ORDER BY SUM(CAST(g.GIFTAMOUNT AS DECIMAL(15,2))) DESC LIMIT 10
    - For "top donors by year" (descending): SELECT c.FULLNAME as 'Full Name', SUM(CAST(g.GIFTAMOUNT AS DECIMAL(15,2))) as 'Total Amount', YEAR(g.GIFTDATE) as 'Year', g.GIFTID as 'Gift ID', g.GIFTDATE as 'Gift Date', g.GIFTAMOUNT as 'Gift Amount', g.PAYMENTMETHOD as 'Payment Method', g.PLEDGEID as 'Pledge ID', g.SOFTCREDITINDICATOR as 'Soft Credit Indicator', g.SOFTCREDITAMOUNT as 'Soft Credit Amount', g.SOFTCREDITID as 'Soft Credit ID', g.SOURCECODE as 'Source Code', g.DESIGNATION as 'Designation', c.EMAIL as 'Email' FROM gifts g JOIN constituents c ON g.ACCOUNTID = c.ACCOUNTID WHERE YEAR(g.GIFTDATE) = [YEAR] GROUP BY g.ACCOUNTID, c.FULLNAME ORDER BY SUM(CAST(g.GIFTAMOUNT AS DECIMAL(15,2))) DESC LIMIT 10
    - For "gifts by donor": SELECT c.FULLNAME as 'Full Name', g.GIFTAMOUNT as 'Gift Amount', g.GIFTDATE as 'Gift Date', g.GIFTID as 'Gift ID', g.PAYMENTMETHOD as 'Payment Method', g.PLEDGEID as 'Pledge ID', g.SOFTCREDITINDICATOR as 'Soft Credit Indicator', g.SOFTCREDITAMOUNT as 'Soft Credit Amount', g.SOFTCREDITID as 'Soft Credit ID', g.SOURCECODE as 'Source Code', g.DESIGNATION as 'Designation', c.EMAIL as 'Email' FROM gifts g JOIN constituents c ON g.ACCOUNTID = c.ACCOUNTID WHERE c.FULLNAME = 'Donor Name' ORDER BY g.GIFTDATE ASC LIMIT 100
    - For "alumni donors": SELECT c.FULLNAME as 'Full Name', c.ALUMNITYPE as 'Alumni Type', g.GIFTAMOUNT as 'Gift Amount', g.GIFTID as 'Gift ID', g.GIFTDATE as 'Gift Date', g.PAYMENTMETHOD as 'Payment Method', g.PLEDGEID as 'Pledge ID', g.SOFTCREDITINDICATOR as 'Soft Credit Indicator', g.SOFTCREDITAMOUNT as 'Soft Credit Amount', g.SOFTCREDITID as 'Soft Credit ID', g.SOURCECODE as 'Source Code', g.DESIGNATION as 'Designation', c.EMAIL as 'Email' FROM gifts g JOIN constituents c ON g.ACCOUNTID = c.ACCOUNTID WHERE c.ALUMNITYPE IS NOT NULL ORDER BY g.GIFTDATE ASC LIMIT 50
    - For "donors by gender": SELECT c.FULLNAME as 'Full Name', c.GENDER as 'Gender', SUM(CAST(g.GIFTAMOUNT AS DECIMAL(15,2))) as 'Total Amount', g.GIFTID as 'Gift ID', g.GIFTDATE as 'Gift Date', g.PAYMENTMETHOD as 'Payment Method', g.PLEDGEID as 'Pledge ID', g.SOFTCREDITINDICATOR as 'Soft Credit Indicator', g.SOFTCREDITAMOUNT as 'Soft Credit Amount', g.SOFTCREDITID as 'Soft Credit ID', g.SOURCECODE as 'Source Code', g.DESIGNATION as 'Designation' FROM gifts g JOIN constituents c ON g.ACCOUNTID = c.ACCOUNTID GROUP BY c.GENDER, c.FULLNAME ORDER BY SUM(CAST(g.GIFTAMOUNT AS DECIMAL(15,2))) ASC LIMIT 25
    - For "donors by age": SELECT c.FULLNAME as 'Full Name', c.AGE as 'Age', AVG(CAST(g.GIFTAMOUNT AS DECIMAL(15,2))) as 'Average Amount', g.GIFTID as 'Gift ID', g.GIFTDATE as 'Gift Date', g.PAYMENTMETHOD as 'Payment Method', g.PLEDGEID as 'Pledge ID', g.SOFTCREDITINDICATOR as 'Soft Credit Indicator', g.SOFTCREDITAMOUNT as 'Soft Credit Amount', g.SOFTCREDITID as 'Soft Credit ID', g.SOURCECODE as 'Source Code', g.DESIGNATION as 'Designation' FROM gifts g JOIN constituents c ON g.ACCOUNTID = c.ACCOUNTID GROUP BY c.AGE, c.FULLNAME ORDER BY AVG(CAST(g.GIFTAMOUNT AS DECIMAL(15,2))) ASC LIMIT 25
    - For "volunteer donors": SELECT c.FULLNAME as 'Full Name', c.VOLUNTEER as 'Volunteer', g.GIFTAMOUNT as 'Gift Amount', g.GIFTID as 'Gift ID', g.GIFTDATE as 'Gift Date', g.PAYMENTMETHOD as 'Payment Method', g.PLEDGEID as 'Pledge ID', g.SOFTCREDITINDICATOR as 'Soft Credit Indicator', g.SOFTCREDITAMOUNT as 'Soft Credit Amount', g.SOFTCREDITID as 'Soft Credit ID', g.SOURCECODE as 'Source Code', g.DESIGNATION as 'Designation' FROM gifts g JOIN constituents c ON g.ACCOUNTID = c.ACCOUNTID WHERE c.VOLUNTEER = 'Yes' ORDER BY g.GIFTDATE ASC LIMIT 50
    - For "high wealth donors": SELECT c.FULLNAME as 'Full Name', c.WEALTHSCORE as 'Wealth Score', g.GIFTAMOUNT as 'Gift Amount', g.GIFTID as 'Gift ID', g.GIFTDATE as 'Gift Date', g.PAYMENTMETHOD as 'Payment Method', g.PLEDGEID as 'Pledge ID', g.SOFTCREDITINDICATOR as 'Soft Credit Indicator', g.SOFTCREDITAMOUNT as 'Soft Credit Amount', g.SOFTCREDITID as 'Soft Credit ID', g.SOURCECODE as 'Source Code', g.DESIGNATION as 'Designation' FROM gifts g JOIN constituents c ON g.ACCOUNTID = c.ACCOUNTID WHERE c.WEALTHSCORE > 50 ORDER BY c.WEALTHSCORE ASC LIMIT 50
    - For "gifts by source": SELECT g.SOURCECODE as 'Source Code', COUNT(*) as 'Gift Count', SUM(CAST(g.GIFTAMOUNT AS DECIMAL(15,2))) as 'Total Amount' FROM gifts g JOIN constituents c ON g.ACCOUNTID = c.ACCOUNTID GROUP BY g.SOURCECODE ORDER BY SUM(CAST(g.GIFTAMOUNT AS DECIMAL(15,2))) ASC LIMIT 20
    - For "gifts by designation": SELECT g.DESIGNATION as 'Designation', COUNT(*) as 'Gift Count', SUM(CAST(g.GIFTAMOUNT AS DECIMAL(15,2))) as 'Total Amount' FROM gifts g JOIN constituents c ON g.ACCOUNTID = c.ACCOUNTID GROUP BY g.DESIGNATION ORDER BY SUM(CAST(g.GIFTAMOUNT AS DECIMAL(15,2))) ASC LIMIT 20

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
    IMPORTANT: For "top" queries, always get the highest values first, then apply the requested sort order to those results.
    - For "top X in descending order": Use ORDER BY column DESC LIMIT X (highest values, highest first)
    - For "top X in ascending order": Use ORDER BY column DESC LIMIT X (get highest first, then post-process to ascending)
    - For "bottom X in ascending order": Use ORDER BY column ASC LIMIT X (lowest values, lowest first)
    - For "bottom X in descending order": Use ORDER BY column ASC LIMIT X (get lowest first, then post-process to descending)
    
    CRITICAL: When user asks for "top X in ascending order", the SQL should ALWAYS use ORDER BY column DESC LIMIT X to get the highest values first. The ascending sorting will be applied in post-processing.
    
    Pay attention to the user's sorting request. If they ask for "descending", "high to low", "largest to smallest", or "z to a", use DESC. If they ask for "ascending", "low to high", "smallest to largest", or "a to z", use ASC. Default to ASC only if no specific direction is mentioned.
    Use LIMIT for limiting results.
    All column names are in UPPERCASE.
    CRITICAL: Always use the human-readable aliases provided above instead of SELECT *. 
    Include the most relevant fields with proper aliases for better readability.
    Never use SELECT * - always specify individual columns with their aliases.
    
    CRITICAL SQL SYNTAX RULES:
    - Use actual database column names (FULLNAME, GIFTAMOUNT, etc.) in SELECT statements
    - Apply aliases using 'as' keyword (e.g., c.FULLNAME as 'Full Name')
    - Do NOT use backticks around column names in SELECT
    - Use single quotes for string literals and aliases
    - Example: SELECT c.FULLNAME as 'Full Name', g.GIFTAMOUNT as 'Gift Amount'
    - CRITICAL: In ORDER BY clauses, use the actual column expression, NOT the alias name in quotes
    - CORRECT: ORDER BY SUM(CAST(g.GIFTAMOUNT AS DECIMAL(15,2))) DESC
    - INCORRECT: ORDER BY 'Total Amount' DESC (this orders by the literal string, not the column)
    - For aggregated columns, repeat the aggregation function in ORDER BY
    - For simple columns, use the table alias and column name: ORDER BY g.GIFTDATE ASC
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