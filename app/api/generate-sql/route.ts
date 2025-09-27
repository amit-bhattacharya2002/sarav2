// File: app/api/generate-sql/route.ts
// DEMO MODE: Simplified direct natural language to SQL conversion (intent extraction commented out)
import { NextRequest, NextResponse } from 'next/server'
import { openai as openaiConfig, features, app } from '@/lib/config'
import { rateLimiters, createRateLimitHeaders, checkRateLimit } from '@/lib/rate-limiter'

// ---------- Intent Types & Helpers ----------

type SortField = 'amount' | 'age' | 'name' | 'date'
type SortDir = 'asc' | 'desc'
type Operation =
  | 'top_donors'
  | 'top_donations'
  | 'list_donors'
  | 'list_donations'
  | 'aggregate'
  | 'explain_schema'

type Intent = {
  operation: Operation
  limit?: number | null
  date?: { year?: number | null; range?: { from: string; to: string } | null } | null
  filters?: {
    donor?: { 
      name?: string | null
      gender?: string | null
      alumniType?: string | null
      age?: { min?: number | null; max?: number | null } | null
    } | null
    amount?: { min?: number | null; max?: number | null } | null
    designation?: string | null
  } | null
  sort?: Array<{ field: SortField; direction: SortDir }> | null
  include?: string[] | null
  top_semantics?: 'donors' | 'donations' | 'auto' | null
  notes?: string | null
}

function parseIntent(jsonText: string): Intent | null {
  try {
    const obj = JSON.parse(jsonText)
    // minimal runtime checks (no external libs)
    if (!obj || typeof obj !== 'object') return null
    if (!obj.operation) return null
    // normalize
    if (obj.limit == null) obj.limit = 10
    return obj as Intent
  } catch {
    return null
  }
}

const SCHEMA_TEXT = `
MySQL/MariaDB Database Schema:
- gifts (alias g): ACCOUNTID, GIFTID, GIFTDATE, GIFTAMOUNT, TRANSACTIONTYPE, GIFTTYPE, PAYMENTMETHOD, PLEDGEID, SOFTCREDITINDICATOR, SOFTCREDITAMOUNT, SOFTCREDITID, SOURCECODE, DESIGNATION, UNIT, PURPOSECATEGORY, APPEAL, GIVINGLEVEL, UUID
- constituents (alias c): ACCOUNTID, LOOKUPID, TYPE, DONORTYPE1, PERSONORGANIZATIONINDICATOR, ALUMNITYPE, UNDERGRADUATEDEGREE1, UNDERGRADUATIONYEAR1, UNDERGRADUATEPREFERREDCLASSYEAR1, UNDERGRADUATESCHOOL1, UNDERGRADUATEDEGREE2, UNDERGRADUATEGRADUATIONYEAR2, UNDERGRADUATEPREFERREDCLASSYEAR2, UNDERGRADUATESCHOOL2, GRADUATEDEGREE1, GRADUATEGRADUATIONYEAR1, GRADUATEPREFERREDCLASSYEAR1, GRADUATESCHOOL1, GRADUATEDEGREE2, GRADUATEGRADUATIONYEAR2, GRADUATEPREFERREDCLASSYEAR2, GRADUATESCHOOL2, GENDER, DECEASED, SOLICITATIONRESTRICTIONS, DONOTMAIL, DONOTPHONE, DONOTEMAIL, MARRIEDTOALUM, SPOUSELOOKUPID, SPOUSEID, ASSIGNEDACCOUNT, VOLUNTEER, WEALTHSCORE, GEPSTATUS, EVENTSATTENDED, EVENTS, AGE, FULLNAME, PMFULLNAME, FULLADDRESS, HOMETELEPHONE, EMAIL

Join key:
- g.ACCOUNTID = c.ACCOUNTID
`.trim()

// ---------- Fast Path Router ----------

function fastPathSQL(q: string): string | null {
  // Pattern 1: "top N donors of YEAR by/sort by FIELD" (with various sorting options)
  const m1 = q.match(/\btop\s+(\d+)\s+donors?\s+of\s+(\d{4})(?:\s+by\s+(?:their\s+)?(\w+)|\s*,\s*sort\s+by\s+(\w+)(?:\s+in\s+(?:ascending|descending)\s+order)?)\b/i)
  if (m1) {
    const n = Math.min(parseInt(m1[1],10), 100)
    const y = parseInt(m1[2],10)
    const sortField = m1[3] || m1[4] // Either "by FIELD" or "sort by FIELD"
    
    // Check if it's descending order
    const isDesc = /\bdescending\b/i.test(q)
    const sortOrder = isDesc ? 'DESC' : 'ASC'
    
    // Determine what columns to include and how to sort
    let selectColumns = ''
    let orderByClause = ''
    
    switch (sortField?.toLowerCase()) {
      case 'age':
        selectColumns = `
  COALESCE(NULLIF(TRIM(c.FULLNAME), ''), CONCAT('[Account ', dt.ACCOUNTID, ']')) AS \`Full Name\`,
  CASE WHEN TRIM(c.AGE) IS NOT NULL AND TRIM(c.AGE) != '' AND CAST(NULLIF(TRIM(c.AGE), '') AS UNSIGNED) IS NOT NULL
       THEN CAST(NULLIF(TRIM(c.AGE), '') AS UNSIGNED)
       ELSE NULL END AS \`Age\`,
  dt.total_amount AS \`Total Amount\``
        orderByClause = `
  dt.total_amount DESC,
  CAST(NULLIF(TRIM(c.AGE), '') AS UNSIGNED) IS NULL,
  CAST(NULLIF(TRIM(c.AGE), '') AS UNSIGNED) ${sortOrder},
  (TRIM(c.FULLNAME) = '' OR c.FULLNAME IS NULL),
  c.FULLNAME ASC,
  dt.ACCOUNTID ASC`
        break
        
      case 'name':
        selectColumns = `
  COALESCE(NULLIF(TRIM(c.FULLNAME), ''), CONCAT('[Account ', dt.ACCOUNTID, ']')) AS \`Full Name\`,
  dt.total_amount AS \`Total Amount\``
        orderByClause = `
  dt.total_amount DESC,
  (TRIM(c.FULLNAME) = '' OR c.FULLNAME IS NULL),
  c.FULLNAME ${sortOrder},
  dt.ACCOUNTID ASC`
        break
        
      case 'amount':
      case 'total':
      case 'donation':
      case 'donations':
        selectColumns = `
  COALESCE(NULLIF(TRIM(c.FULLNAME), ''), CONCAT('[Account ', dt.ACCOUNTID, ']')) AS \`Full Name\`,
  dt.total_amount AS \`Total Amount\``
        orderByClause = `
  dt.total_amount ${sortOrder},
  (TRIM(c.FULLNAME) = '' OR c.FULLNAME IS NULL),
  c.FULLNAME ASC,
  dt.ACCOUNTID ASC`
        break
        
      default:
        // For unknown sort fields, default to amount sorting
        selectColumns = `
  COALESCE(NULLIF(TRIM(c.FULLNAME), ''), CONCAT('[Account ', dt.ACCOUNTID, ']')) AS \`Full Name\`,
  dt.total_amount AS \`Total Amount\``
        orderByClause = `
  dt.total_amount ${sortOrder},
  (TRIM(c.FULLNAME) = '' OR c.FULLNAME IS NULL),
  c.FULLNAME ASC,
  dt.ACCOUNTID ASC`
    }
    
    return `
SELECT${selectColumns}
FROM (
  SELECT g.ACCOUNTID, SUM(CAST(g.GIFTAMOUNT AS DECIMAL(15,2))) AS total_amount
  FROM gifts g
  WHERE g.GIFTDATE >= '${y}-01-01' AND g.GIFTDATE < '${y+1}-01-01'
  GROUP BY g.ACCOUNTID
  ORDER BY total_amount DESC
  LIMIT ${n * 5}
) dt
LEFT JOIN constituents c ON c.ACCOUNTID = dt.ACCOUNTID
ORDER BY${orderByClause}
LIMIT ${n}`.trim()
  }
  
  // Pattern 2: "top N donors of YEAR" (basic, no age sorting)
  // BUT only if no additional sorting/filtering is mentioned
  const m2 = q.match(/\btop\s+(\d+)\s+donors?\s+of\s+(\d{4})\b/i)
  if (m2 && !q.match(/\b(?:and\s+)?(?:sort|by|age|name|amount|older|younger|between|gender|alumni)\b/i)) {
    const n = Math.min(parseInt(m2[1],10), 100)
    const y = parseInt(m2[2],10)
    return `
SELECT
  COALESCE(NULLIF(TRIM(c.FULLNAME), ''), CONCAT('[Account ', dt.ACCOUNTID, ']')) AS \`Full Name\`,
  dt.total_amount AS \`Total Amount\`
FROM (
  SELECT g.ACCOUNTID, SUM(CAST(g.GIFTAMOUNT AS DECIMAL(15,2))) AS total_amount
  FROM gifts g
  WHERE g.GIFTDATE >= '${y}-01-01' AND g.GIFTDATE < '${y+1}-01-01'
  GROUP BY g.ACCOUNTID
  ORDER BY total_amount DESC
  LIMIT ${n}
) dt
LEFT JOIN constituents c ON c.ACCOUNTID = dt.ACCOUNTID
ORDER BY
  dt.total_amount DESC,
  (TRIM(c.FULLNAME) = '' OR c.FULLNAME IS NULL),
  c.FULLNAME ASC,
  dt.ACCOUNTID ASC
LIMIT ${n}`.trim()
  }
  
  // Pattern 2b: "top donors of YEAR" or "show me top donors of YEAR" (without explicit number, defaults to 10)
  // BUT only if no additional sorting/filtering is mentioned
  const m2b = q.match(/\b(?:show\s+me\s+)?top\s+donors?\s+of\s+(\d{4})\b/i)
  if (m2b && !q.match(/\b(?:and\s+)?(?:sort|by|age|name|amount|older|younger|between|gender|alumni)\b/i)) {
    const n = 10 // Default limit
    const y = parseInt(m2b[1],10)
    return `
SELECT
  COALESCE(NULLIF(TRIM(c.FULLNAME), ''), CONCAT('[Account ', dt.ACCOUNTID, ']')) AS \`Full Name\`,
  dt.total_amount AS \`Total Amount\`
FROM (
  SELECT g.ACCOUNTID, SUM(CAST(g.GIFTAMOUNT AS DECIMAL(15,2))) AS total_amount
  FROM gifts g
  WHERE g.GIFTDATE >= '${y}-01-01' AND g.GIFTDATE < '${y+1}-01-01'
  GROUP BY g.ACCOUNTID
  ORDER BY total_amount DESC
  LIMIT ${n}
) dt
LEFT JOIN constituents c ON c.ACCOUNTID = dt.ACCOUNTID
ORDER BY
  dt.total_amount DESC,
  (TRIM(c.FULLNAME) = '' OR c.FULLNAME IS NULL),
  c.FULLNAME ASC,
  dt.ACCOUNTID ASC
LIMIT ${n}`.trim()
  }
  
  // Pattern 3: "top N donations of YEAR"
  const m3 = q.match(/\btop\s+(\d+)\s+donations?\s+of\s+(\d{4})\b/i)
  if (m3) {
    const n = Math.min(parseInt(m3[1],10), 100)
    const y = parseInt(m3[2],10)
    return `
SELECT g.GIFTID AS \`Gift ID\`, 
       COALESCE(NULLIF(TRIM(c.FULLNAME), ''), CONCAT('[Account ', g.ACCOUNTID, ']')) AS \`Full Name\`,
       CAST(g.GIFTAMOUNT AS DECIMAL(15,2)) AS \`Gift Amount\`,
       g.GIFTDATE AS \`Gift Date\`
FROM gifts g
LEFT JOIN constituents c ON c.ACCOUNTID = g.ACCOUNTID
WHERE g.GIFTDATE >= '${y}-01-01' AND g.GIFTDATE < '${y+1}-01-01'
ORDER BY 
  CAST(g.GIFTAMOUNT AS DECIMAL(15,2)) DESC, 
  g.GIFTDATE DESC, 
  (TRIM(c.FULLNAME) = '' OR c.FULLNAME IS NULL),
  c.FULLNAME ASC, 
  g.ACCOUNTID ASC
LIMIT ${n}`.trim()
  }

  // Pattern 4: "top N donors of YEAR, include FIELD1, FIELD2" (with include requests)
  // BUT only if no additional sorting is mentioned
  const m4 = q.match(/\btop\s+(\d+)\s+donors?\s+of\s+(\d{4})(?:,|\s+and)?\s+include\s+(.+?)(?:\s+and\s+(.+?))?(?:\s+and\s+(.+?))?$/i)
  if (m4 && !q.match(/\b(?:and\s+)?(?:sort|by|older|younger|between)\b/i)) {
    console.log('🔍 Pattern 4 matched:', m4)
    const n = Math.min(parseInt(m4[1],10), 100)
    const y = parseInt(m4[2],10)
    const includeFields = [m4[3], m4[4], m4[5]].filter(Boolean).flatMap(f => 
      f.split(',').map(field => field.trim().toLowerCase())
    )
    console.log('🔍 Include fields parsed:', includeFields)
    
    // Build SELECT columns based on include fields
    let selectColumns = `
  COALESCE(NULLIF(TRIM(c.FULLNAME), ''), CONCAT('[Account ', dt.ACCOUNTID, ']')) AS \`Full Name\`,
  dt.total_amount AS \`Total Amount\``
    
    // Add requested fields
    if (includeFields.includes('age')) {
      selectColumns += `,
  CASE WHEN TRIM(c.AGE) IS NOT NULL AND TRIM(c.AGE) != '' AND CAST(NULLIF(TRIM(c.AGE), '') AS UNSIGNED) IS NOT NULL
       THEN CAST(NULLIF(TRIM(c.AGE), '') AS UNSIGNED)
       ELSE NULL END AS \`Age\``
    }
    if (includeFields.includes('gender')) {
      selectColumns += `,
  c.GENDER AS \`Gender\``
    }
    if (includeFields.includes('email')) {
      selectColumns += `,
  c.EMAIL AS \`Email\``
    }
    if (includeFields.includes('phone') || includeFields.includes('telephone')) {
      selectColumns += `,
  c.HOMETELEPHONE AS \`Phone\``
    }
    if (includeFields.includes('address')) {
      selectColumns += `,
  c.FULLADDRESS AS \`Address\``
    }
    if (includeFields.includes('alumni') || includeFields.includes('alumnitype')) {
      selectColumns += `,
  c.ALUMNITYPE AS \`Alumni Type\``
    }
    
    return `
SELECT${selectColumns}
FROM (
  SELECT g.ACCOUNTID, SUM(CAST(g.GIFTAMOUNT AS DECIMAL(15,2))) AS total_amount
  FROM gifts g
  WHERE g.GIFTDATE >= '${y}-01-01' AND g.GIFTDATE < '${y+1}-01-01'
  GROUP BY g.ACCOUNTID
  ORDER BY total_amount DESC
  LIMIT ${n}
) dt
LEFT JOIN constituents c ON c.ACCOUNTID = dt.ACCOUNTID
ORDER BY
  dt.total_amount DESC,
  (TRIM(c.FULLNAME) = '' OR c.FULLNAME IS NULL),
  c.FULLNAME ASC,
  dt.ACCOUNTID ASC
LIMIT ${n}`.trim()
  }

  // Pattern 4b: "show me top donors of YEAR, include FIELD1, FIELD2" (without explicit number)
  // BUT only if no additional sorting is mentioned
  const m4b = q.match(/\b(?:show\s+me\s+)?top\s+donors?\s+of\s+(\d{4})(?:,|\s+and)?\s+include\s+(.+?)(?:\s+and\s+(.+?))?(?:\s+and\s+(.+?))?$/i)
  if (m4b && !q.match(/\b(?:and\s+)?(?:sort|by|older|younger|between)\b/i)) {
    console.log('🔍 Pattern 4b matched:', m4b)
    const n = 10 // Default limit
    const y = parseInt(m4b[1],10)
    const includeFields = [m4b[2], m4b[3], m4b[4]].filter(Boolean).flatMap(f => 
      f.split(',').map(field => field.trim().toLowerCase())
    )
    console.log('🔍 Include fields parsed (4b):', includeFields)
    
    // Build SELECT columns based on include fields (same logic as Pattern 4)
    let selectColumns = `
  COALESCE(NULLIF(TRIM(c.FULLNAME), ''), CONCAT('[Account ', dt.ACCOUNTID, ']')) AS \`Full Name\`,
  dt.total_amount AS \`Total Amount\``
    
    // Add requested fields
    if (includeFields.includes('age')) {
      selectColumns += `,
  CASE WHEN TRIM(c.AGE) IS NOT NULL AND TRIM(c.AGE) != '' AND CAST(NULLIF(TRIM(c.AGE), '') AS UNSIGNED) IS NOT NULL
       THEN CAST(NULLIF(TRIM(c.AGE), '') AS UNSIGNED)
       ELSE NULL END AS \`Age\``
    }
    if (includeFields.includes('gender')) {
      selectColumns += `,
  c.GENDER AS \`Gender\``
    }
    if (includeFields.includes('email')) {
      selectColumns += `,
  c.EMAIL AS \`Email\``
    }
    if (includeFields.includes('phone') || includeFields.includes('telephone')) {
      selectColumns += `,
  c.HOMETELEPHONE AS \`Phone\``
    }
    if (includeFields.includes('address')) {
      selectColumns += `,
  c.FULLADDRESS AS \`Address\``
    }
    if (includeFields.includes('alumni') || includeFields.includes('alumnitype')) {
      selectColumns += `,
  c.ALUMNITYPE AS \`Alumni Type\``
    }
    
    return `
SELECT${selectColumns}
FROM (
  SELECT g.ACCOUNTID, SUM(CAST(g.GIFTAMOUNT AS DECIMAL(15,2))) AS total_amount
  FROM gifts g
  WHERE g.GIFTDATE >= '${y}-01-01' AND g.GIFTDATE < '${y+1}-01-01'
  GROUP BY g.ACCOUNTID
  ORDER BY total_amount DESC
  LIMIT ${n}
) dt
LEFT JOIN constituents c ON c.ACCOUNTID = dt.ACCOUNTID
ORDER BY
  dt.total_amount DESC,
  (TRIM(c.FULLNAME) = '' OR c.FULLNAME IS NULL),
  c.FULLNAME ASC,
  dt.ACCOUNTID ASC
LIMIT ${n}`.trim()
  }
  
  return null
}

// ---------- Logging Helper ----------

function logIntent(question: string, intent: Intent | null, rawIntentText?: string) {
  console.log('\n=== INTENT EXTRACTION ===')
  console.log('Question:', question)
  console.log('Raw Intent Text:', rawIntentText || 'N/A')
  console.log('Parsed Intent:', JSON.stringify(intent, null, 2))
  console.log('=== END INTENT ===\n')
}

// ---------- Prompts (short & robust) ----------

const INTENT_PROMPT = `
You extract user INTENT for a donor & gifts database.

Output ONLY compact JSON (no prose, no code fences) with fields:
{
  "operation": "top_donors | top_donations | list_donors | list_donations | aggregate | explain_schema",
  "limit": <number or null>,
  "date": { "year": <number or null>, "range": {"from":"YYYY-MM-DD","to":"YYYY-MM-DD"} | null } | null,
  "filters": {
    "donor": { "name": <string|null>, "gender": <string|null>, "alumniType": <string|null>, "age": { "min": <number|null>, "max": <number|null> } | null } | null,
    "amount": { "min": <number|null>, "max": <number|null> } | null,
    "designation": <string|null>
  } | null,
  "sort": [ { "field": "amount|age|name|date", "direction": "asc|desc" } ] | null,
  "include": [<string>...] | null,
  "top_semantics": "donors|donations|auto" | null,
  "notes": <string|null>
}

Rules:
- If the ask mentions donors/people/accounts → donors. If donations/gifts/transactions → donations.
- Default limit = 10 when not specified.
- The right-most spoken sort is the overall sort; map to amount/age/name/date.
- If the user asks about schema/columns, set operation="explain_schema".
- Age filters: "older than 50" → filters.donor.age.min = 50, "younger than 30" → filters.donor.age.max = 30
- Age ranges: "between 25 and 65" → filters.donor.age.min = 25, filters.donor.age.max = 65
- Age exclusion: "only include fields that have age" → filters.donor.age.min = 0 (excludes NULL ages)
- Include age field: If age is mentioned (filters, sorting, or display), add "age" to include array
- Use null for unknowns. Output ONLY the JSON.
`.trim()

const SQL_PROMPT_PREFIX = `
Convert the given INTENT JSON + SCHEMA into ONE MariaDB 10.11 SELECT.
Output ONLY SQL (no comments, no semicolon). Always end with LIMIT (≤100).

SCHEMA:
${SCHEMA_TEXT}

Rules:
- Tables: gifts g, constituents c; join on g.ACCOUNTID = c.ACCOUNTID.
- Donors (people/accounts) → aggregate by ACCOUNTID (GROUP BY). Donations (transactions) → NO GROUP BY.
- Amounts: use CAST(g.GIFTAMOUNT AS DECIMAL(15,2)).
- Dates: year Y → g.GIFTDATE >= 'Y-01-01' AND g.GIFTDATE < 'Y+1-01-01'; if range provided, use it; else no date filter.
- FULLNAME display (CRITICAL): Use COALESCE(NULLIF(TRIM(c.FULLNAME), ''), CONCAT('[Account ', ACCOUNTID, ']')) AS \`Full Name\` to handle missing/empty names.
  - AGE display:
  CASE WHEN TRIM(c.AGE) IS NOT NULL AND TRIM(c.AGE) != '' AND CAST(NULLIF(TRIM(c.AGE), '') AS UNSIGNED) IS NOT NULL
       THEN CAST(NULLIF(TRIM(c.AGE), '') AS UNSIGNED)
       ELSE NULL END AS \`Age\`
  - ALWAYS include dt.total_amount AS \`Total Amount\` in donor queries (top_donors, list_donors).
- AGE filters: filters.donor.age.min → CAST(NULLIF(TRIM(c.AGE), '') AS UNSIGNED) >= min, filters.donor.age.max → CAST(NULLIF(TRIM(c.AGE), '') AS UNSIGNED) <= max
- If sorting by age, use the same CASE expression in ORDER BY: CAST(NULLIF(TRIM(c.AGE), '') AS UNSIGNED) IS NULL, CAST(NULLIF(TRIM(c.AGE), '') AS UNSIGNED) {ASC|DESC}.
- Never invent columns. Do not mix donor aggregates with individual gift fields in the same SELECT.
- Tie-breakers after the main sort: (TRIM(c.FULLNAME) = '' OR c.FULLNAME IS NULL), c.FULLNAME ASC, (dt.ACCOUNTID or g.ACCOUNTID) ASC.
- Keep projection aligned with "include" when provided.

Routing:
- operation=top_donors:
  - ALWAYS SELECT: Full Name, Total Amount, and any requested fields (age, etc.)
  - ALWAYS use subquery with ORDER BY total_amount DESC LIMIT N (get exactly the top N donors by amount)
  - Final ORDER BY: For age/name/date sorting, use requested field as PRIMARY sort, with dt.total_amount DESC as tie-breaker
  - For amount sorting: subquery gets top donors, final sort applies user's amount direction (asc/desc)
  - For age/name/date sorting: subquery gets top donors by amount, final sort by requested field + tie-breakers
  - CRITICAL: "Top N" means get the N highest donors by total amount FIRST, then sort those by the requested field
- operation=top_donations: no GROUP BY; ORDER BY amount/date; LIMIT N.
- operation=list_donors/list_donations: similar but without "top" semantics (no forced DESC by amount).
- If include requests gift_date in donor aggregates, expose MAX(g.GIFTDATE) AS last_gift_date in subquery and project as dt.last_gift_date.

Example for "top 10 donors of 2021, sort by age ascending":
ORDER BY CAST(NULLIF(TRIM(c.AGE), '') AS UNSIGNED) IS NULL, CAST(NULLIF(TRIM(c.AGE), '') AS UNSIGNED) ASC, dt.total_amount DESC, tie-breakers

Example for "top 10 donors of 2021, sort by amount ascending":
SELECT c.FULLNAME AS \`Full Name\`, dt.total_amount AS \`Total Amount\`
FROM (
  SELECT g.ACCOUNTID, SUM(CAST(g.GIFTAMOUNT AS DECIMAL(15,2))) AS total_amount
  FROM gifts g
  WHERE g.GIFTDATE >= '2021-01-01' AND g.GIFTDATE < '2022-01-01'
  GROUP BY g.ACCOUNTID
  ORDER BY total_amount DESC
  LIMIT 10
) dt
LEFT JOIN constituents c ON c.ACCOUNTID = dt.ACCOUNTID
ORDER BY dt.total_amount ASC, c.FULLNAME ASC, dt.ACCOUNTID ASC
LIMIT 10
`.trim()

// DEMO MODE: Direct Natural Language to SQL Prompt
const DEMO_SQL_PROMPT = `
You are a SQL expert for a donor & gifts database. Convert natural language questions directly into MariaDB 10.11 SELECT queries.

DATABASE SCHEMA:
- gifts table: id, ACCOUNTID, GIFTID, GIFTDATE, GIFTAMOUNT, TRANSACTIONTYPE, GIFTTYPE, PAYMENTMETHOD, PLEDGEID, SOFTCREDITINDICATOR, SOFTCREDITAMOUNT, SOFTCREDITID, SOURCECODE, DESIGNATION, UNIT, PURPOSECATEGORY, APPEAL, GIVINGLEVEL, UUID
- constituents table: id, ACCOUNTID, LOOKUPID, TYPE, DONORTYPE1, PERSONORGANIZATIONINDICATOR, ALUMNITYPE, UNDERGRADUATEDEGREE1, UNDERGRADUATIONYEAR1, UNDERGRADUATEPREFERREDCLASSYEAR1, UNDERGRADUATESCHOOL1, UNDERGRADUATEDEGREE2, UNDERGRADUATEGRADUATIONYEAR2, UNDERGRADUATEPREFERREDCLASSYEAR2, UNDERGRADUATESCHOOL2, GRADUATEDEGREE1, GRADUATEGRADUATIONYEAR1, GRADUATEPREFERREDCLASSYEAR1, GRADUATESCHOOL1, GRADUATEDEGREE2, GRADUATEGRADUATIONYEAR2, GRADUATEPREFERREDCLASSYEAR2, GRADUATESCHOOL2, GENDER, DECEASED, SOLICITATIONRESTRICTIONS, DONOTMAIL, DONOTPHONE, DONOTEMAIL, MARRIEDTOALUM, SPOUSELOOKUPID, SPOUSEID, ASSIGNEDACCOUNT, VOLUNTEER, WEALTHSCORE, GEPSTATUS, EVENTSATTENDED, EVENTS, AGE, GUID, FULLNAME, PMFULLNAME, FULLADDRESS, HOMETELEPHONE, EMAIL

RULES:
- Output ONLY valid SQL - no explanations, no comments, no semicolons
- Always use JOIN: FROM gifts g JOIN constituents c ON g.ACCOUNTID = c.ACCOUNTID
- Use human-readable aliases: c.FULLNAME AS 'Full Name', g.GIFTAMOUNT AS 'Gift Amount', g.GIFTDATE AS 'Gift Date'
- For amounts: CAST(g.GIFTAMOUNT AS DECIMAL(15,2))
- For dates: year 2021 → g.GIFTDATE >= '2021-01-01' AND g.GIFTDATE < '2022-01-01'
- For "top donors": GROUP BY g.ACCOUNTID, c.FULLNAME and SUM amounts
- For "top gifts": NO GROUP BY, just ORDER BY amount DESC
- Always end with LIMIT (default 10, max 100)
- Handle missing names: COALESCE(NULLIF(TRIM(c.FULLNAME), ''), CONCAT('[Account ', g.ACCOUNTID, ']')) AS 'Full Name'

EXAMPLES:
- "top 10 donors of 2021" → SELECT c.FULLNAME AS 'Full Name', SUM(CAST(g.GIFTAMOUNT AS DECIMAL(15,2))) AS 'Total Amount' FROM gifts g JOIN constituents c ON g.ACCOUNTID = c.ACCOUNTID WHERE g.GIFTDATE >= '2021-01-01' AND g.GIFTDATE < '2022-01-01' GROUP BY g.ACCOUNTID, c.FULLNAME ORDER BY SUM(CAST(g.GIFTAMOUNT AS DECIMAL(15,2))) DESC LIMIT 10
- "show me all gifts from 2022" → SELECT c.FULLNAME AS 'Full Name', g.GIFTAMOUNT AS 'Gift Amount', g.GIFTDATE AS 'Gift Date' FROM gifts g JOIN constituents c ON g.ACCOUNTID = c.ACCOUNTID WHERE g.GIFTDATE >= '2022-01-01' AND g.GIFTDATE < '2023-01-01' ORDER BY g.GIFTDATE DESC LIMIT 50
- "top 5 gifts of 2023" → SELECT c.FULLNAME AS 'Full Name', g.GIFTAMOUNT AS 'Gift Amount', g.GIFTDATE AS 'Gift Date' FROM gifts g JOIN constituents c ON g.ACCOUNTID = c.ACCOUNTID WHERE g.GIFTDATE >= '2023-01-01' AND g.GIFTDATE < '2024-01-01' ORDER BY CAST(g.GIFTAMOUNT AS DECIMAL(15,2)) DESC LIMIT 5
`.trim()

// ---------- Route ----------

export async function POST(req: NextRequest) {
  try {
    if (app.isBuildTime) {
      return NextResponse.json({ error: 'Service unavailable during build' }, { status: 503 })
    }
    if (!process.env.OPENAI_API_KEY || !process.env.BUSINESS_DATABASE_URL) {
      return NextResponse.json({ 
        error: 'Service configuration error',
        message: 'Required environment variables are not configured'
      }, { status: 500 })
    }

    const rateLimitResult = checkRateLimit(req, 10, 60 * 1000)
    if (!rateLimitResult.allowed) {
      return new Response(JSON.stringify({
          error: 'Too Many Requests',
          message: 'Rate limit exceeded. Please try again later.',
          retryAfter: Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000),
      }), {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            ...createRateLimitHeaders(rateLimitResult),
            'Retry-After': Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000).toString(),
        }
      })
    }

    const { default: OpenAI } = await import('openai')
    const openai = new OpenAI({ apiKey: openaiConfig.apiKey })

    // ---- parse body
    let body: any
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }
    const question = body?.question?.toString()?.trim()
    if (!question) {
      return NextResponse.json({ error: 'Missing question input' }, { status: 400 })
    }

    // ---- Fast path check (skip LLM calls for common patterns)
    const fastPathResult = fastPathSQL(question)
    if (fastPathResult) {
      console.log('⚡ Fast path SQL generated for:', question)
      const response = NextResponse.json({ 
        sql: fastPathResult, 
        success: true, 
        fastPath: true,
        processingTime: 'fast',
        intent: { operation: 'top_donors', fastPath: true }
      })
      const headers = createRateLimitHeaders(rateLimitResult)
      Object.entries(headers).forEach(([k, v]) => response.headers.set(k, v))
      return response
    }

    // ---- DEMO MODE: Direct Natural Language to SQL (Skip Intent Extraction) ----
    console.log('🚀 DEMO MODE ACTIVE: Direct SQL generation for:', question)
    console.log('📝 Skipping intent extraction step for faster demo performance')
    
    // Comment out intent extraction for demo - go directly to SQL generation
    /*
    // ---- Step 1: Intent extraction
    console.log('🔄 Extracting intent for:', question)
    const intentRes = await openai.chat.completions.create({
      model: openaiConfig.model,
      messages: [
        { role: 'system', content: INTENT_PROMPT },
        { role: 'user', content: question }
      ],
      temperature: 0.1,
      max_tokens: 220
    })
    const intentText = intentRes.choices[0]?.message?.content?.trim() ?? ''
    const intent = parseIntent(intentText)
    
    // Log the intent extraction process
    logIntent(question, intent, intentText)
    
    if (!intent) {
      return NextResponse.json({
        error: 'Intent parse failed',
        raw: intentText
      }, { status: 400 })
    }

    // If user asked for schema explanation, return schema (no SQL generation)
    if (intent && intent.operation === 'explain_schema') {
      const response = NextResponse.json({
        intent,
        schema: SCHEMA_TEXT
      })
      const headers = createRateLimitHeaders(rateLimitResult)
      Object.entries(headers).forEach(([k, v]) => response.headers.set(k, v))
      return response
    }

    // ---- Step 2: SQL from Intent
    console.log('🔄 Generating SQL from intent:', intent.operation)
    const sqlRes = await openai.chat.completions.create({
      model: openaiConfig.model,
      messages: [
        { role: 'system', content: SQL_PROMPT_PREFIX },
        { role: 'user', content: JSON.stringify(intent) }
      ],
      temperature: 0.1,
      max_tokens: 360
    })
    */
    
    // ---- DEMO: Direct SQL Generation from Natural Language ----
    const sqlRes = await openai.chat.completions.create({
      model: openaiConfig.model,
      messages: [
        { role: 'system', content: DEMO_SQL_PROMPT },
        { role: 'user', content: question }
      ],
      temperature: 0.1,
      max_tokens: 500
    })
    const sqlQuery = sqlRes.choices[0]?.message?.content?.trim() || ''
    
    console.log('\n=== SQL GENERATION ===')
    console.log('Generated SQL:', sqlQuery)
    console.log('=== END SQL ===\n')

    // Optional: tiny sanity checks before returning (no semicolon, must start with SELECT, has LIMIT)
    if (/;/.test(sqlQuery) || !/^\s*select\b/i.test(sqlQuery) || !/\blimit\s+\d+/i.test(sqlQuery)) {
      return NextResponse.json({
        error: 'SQL validation failed',
        sql: sqlQuery
      }, { status: 400 })
    }

    // ---- DEMO: Return SQL directly (no intent for demo mode)
    const response = NextResponse.json({ 
      sql: sqlQuery,
      success: true,
      fastPath: false,
      processingTime: 'demo',
      demo: true
    })
    const headers = createRateLimitHeaders(rateLimitResult)
    Object.entries(headers).forEach(([k, v]) => response.headers.set(k, v))
    return response
  } catch (error: any) {
    console.error('[SQL_GEN_ERROR]', error)
    const errorMessage = features.enableDetailedErrors 
      ? error?.message || 'Unknown error'
      : 'An error occurred while generating SQL'
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}
