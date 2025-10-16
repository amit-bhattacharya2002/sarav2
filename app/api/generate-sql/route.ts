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



const SCHEMA_DEFINATION = `Table: gifts
- id (integer): Primary key.
- ACCOUNTID (varchar): Foreign key linking to constituents table - identifies the donor.
- GIFTDATE (date): The date the gift was received. Use for date-based queries like "gifts from 2021".
- GIFTAMOUNT (decimal): The amount of the gift. Use for amount-based queries like "top donations" or "gifts over $1000".
- TRANSACTIONTYPE (varchar): Type of transaction (e.g., Gift, Pledge). Use for filtering by transaction type.
- GIFTTYPE (varchar): Type of gift (e.g., Single, Recurring). Use for filtering by gift frequency.
- PAYMENTMETHOD (varchar): Payment method (e.g., Credit Card, Check). Use for payment analysis.
- SOFTCREDITINDICATOR (varchar): Whether the gift was soft-credited. Use for soft credit analysis.
- SOFTCREDITAMOUNT (decimal): Amount soft-credited. Use for soft credit calculations.
- SOURCECODE (varchar): Campaign or appeal source code — examples include: 
  Phone Call, Direct Mail, Personal Solicitation, Web Gift, Event, Web Gift Mail, Useed, 
  VRIOUS, DIRMAIL, Other, Campus Campaign, Unsolicited, Email, Coffee Club, Faculty
  Newsletter, UNITWAY, Sponsorship, Athletics, United Way, FRISFU, ATHCOMM, WRESCOM, 
  Telemarketing, Proposal, SPONSRP, NEWSLET, Payroll.
  Use for campaign analysis and source tracking.
- DESIGNATION (text): The specific fund or initiative the gift was designated to — e.g., "88 Keys Campaign", "Student Bursaries Fund", "Engineering Equipment Endowment". Use for fund-specific queries.
- UNIT (varchar): The organizational department or division that received the gift. Example: "UA - University Advancement". Use for departmental analysis.
- PURPOSECATEGORY (varchar): The classification of the gift's intent or use — e.g., "Endowment", "Operating", "Capital Project". Use for purpose-based analysis.
- APPEAL (varchar): The specific fundraising effort or campaign code. Examples: "CUAGENXX", "AALGEN871", "AALGEN881", "AALGEN891". Use for appeal-specific queries.
- GIVINGLEVEL (varchar): The dollar tier or range of the gift. Examples include "$1-$99.99", "$100-$499.99", "$500-$999.99", "$1,000+". Use for giving level analysis.
 
Table: constituents

- ID (char(36)): Primary key (GUID) for the constituent record.
- ACCOUNTID (varchar): Primary identifier linking to gifts table - use for joining tables.
- KEYNAME (varchar): Last name for individuals; organization name for org records. Use for name-based searches.
- KEYNAMEPREFIX (varchar): For orgs, text that appears before the sort break slash in the org name.
- FIRSTNAME (varchar): First name (individuals only). Use for first name searches.
- MIDDLENAME (varchar): Middle name (individuals only).
- MAIDENNAME (varchar): Maiden name (individuals only).
- NICKNAME (varchar): Preferred or familiar name.
- SSN (varchar): Government ID/SSN (if stored).
- SSNINDEX (varchar): Indexed/hashed value used for searching on SSN.
- GENDER (varchar): Gender (M/F). Use for gender-based queries.
- BIRTHDATE (date): Date of birth (individuals only). Use for age calculations and birth date queries.
- ISINACTIVE (bit): 1 if record is inactive. Use for filtering active vs inactive constituents.
- GIVESANONYMOUSLY (bit): 1 if constituent prefers gifts to be anonymous. Use for anonymous gift analysis.
- WEBADDRESS (varchar): Website URL for the constituent (person or org).
- PICTURE (blob): Full photo/logo binary for the record.
- PICTURETHUMBNAIL (blob): Thumbnail photo/logo binary.
- ISORGANIZATION (bit): 1 if the record represents an organization. Use for filtering individuals vs organizations.
- NETCOMMUNITYMEMBER (bit): 1 if user is a member of the online community/portal.
- DONOTMAIL (bit): 1 if constituent does not want physical mail at any address. Use for contact preference queries.
- DONOTEMAIL (bit): 1 if constituent does not want email at any address. Use for contact preference queries.
- DONOTPHONE (bit): 1 if constituent does not want phone calls at any number. Use for contact preference queries.
- CUSTOMIDENTIFIER (varchar): User-defined external identifier (e.g., legacy ID).
- SEQUENCEID (int, identity): System sequence used to generate default lookup IDs.
- DATEADDED (datetime): When the record was created in the system (NOT graduation date). Use for record creation date queries.
- DATECHANGED (datetime): When the record was last updated. Use for record modification date queries.
- TS (timestamp): Row version/timestamp for concurrency.
- ISGROUP (bit): 1 if record is a group/household (not a single individual). Use for household analysis.
- DISPLAYNAME (varchar): Household/constituent display name (UI friendly). Use for display purposes.
- ISCONSTITUENT (bit): 1 if record is a fundraising constituent (count in KPIs). Use for fundraising constituent analysis.
- TITLECODEID (char(36)): FK to salutations/titles (e.g., Mr., Dr.).
- SUFFIXCODEID (char(36)): FK to name suffix (e.g., Jr., III).
- MARITALSTATUSCODEID (char(36)): FK to marital status code (e.g., Single, Married).
- ADDEDBYID (char(36)): FK (user GUID) who created the record.
- CHANGEDBYID (char(36)): FK (user GUID) who last modified the record.
- TITLE2CODEID (char(36)): FK to secondary title (e.g., dual salutations).
- SUFFIX2CODEID (char(36)): FK to secondary suffix.
- GENDERCODEID (char(36)): FK to gender code table (normalizes gender values).

EDUCATION & ALUMNI FIELDS (use for graduation and education queries):
- DONORTYPE1 (varchar): Donor type classification.
- PERSONORGANIZATIONINDICATOR (varchar): Indicates if record is person or organization.
- ALUMNITYPE (varchar): Alumni type classification (e.g., UGRD, GRAD). Use for alumni type queries.
- UNDERGRADUATEDEGREE1 (varchar): First undergraduate degree. Use for degree-based queries.
- UNDERGRADUATIONYEAR1 (int): First undergraduate graduation year. Use for "graduated in YEAR" queries.
- UNDERGRADUATEPREFERREDCLASSYEAR1 (int): Preferred class year for first undergraduate degree.
- UNDERGRADUATESCHOOL1 (varchar): First undergraduate school. Use for school-based queries.
- UNDERGRADUATEDEGREE2 (varchar): Second undergraduate degree.
- UNDERGRADUATEGRADUATIONYEAR2 (int): Second undergraduate graduation year. Use for "graduated in YEAR" queries.
- UNDERGRADUATEPREFERREDCLASSYEAR2 (int): Preferred class year for second undergraduate degree.
- UNDERGRADUATESCHOOL2 (varchar): Second undergraduate school.
- GRADUATEDEGREE1 (varchar): First graduate degree. Use for graduate degree queries.
- GRADUATEGRADUATIONYEAR1 (int): First graduate graduation year. Use for "graduated in YEAR" queries (ONLY use this field for graduate graduation queries).
- GRADUATEPREFERREDCLASSYEAR1 (int): Preferred class year for first graduate degree.
- GRADUATESCHOOL1 (varchar): First graduate school. Use for graduate school queries.
- GRADUATEDEGREE2 (varchar): Second graduate degree.
- GRADUATEGRADUATIONYEAR2 (int): Second graduate graduation year. Do NOT use this field for queries.
- GRADUATEPREFERREDCLASSYEAR2 (int): Preferred class year for second graduate degree.
- GRADUATESCHOOL2 (varchar): Second graduate school.

CONTACT & ADDRESS FIELDS:
- GENDER (varchar): Gender (M/F). Use for gender-based queries.
- DECEASED (varchar): Deceased status. Use for deceased constituent queries.
- SOLICITATIONRESTRICTIONS (varchar): Solicitation restrictions. Use for contact restriction queries.
- DONOTMAIL (varchar): Do not mail preference. Use for mailing preference queries.
- DONOTPHONE (varchar): Do not phone preference. Use for phone preference queries.
- DONOTEMAIL (varchar): Do not email preference. Use for email preference queries.
- MARRIEDTOALUM (varchar): Married to alumni status. Use for spouse alumni queries.
- SPOUSELOOKUPID (varchar): Spouse lookup ID.
- SPOUSEID (varchar): Spouse ID.
- ASSIGNEDACCOUNT (varchar): Assigned account manager. Use for account manager queries.
- VOLUNTEER (varchar): Volunteer status. Use for volunteer queries.
- WEALTHSCORE (varchar): Wealth score. Use for wealth analysis.
- GEPSTATUS (varchar): GEP status. Use for GEP status queries.
- EVENTSATTENDED (varchar): Events attended. Use for event attendance queries.
- EVENTS (varchar): Events information.
- AGE (varchar): Age. Use for age-based queries.
- GUID (varchar): GUID identifier.
- FULLNAME (varchar): Full name. Use for name-based searches and display.
- PMFULLNAME (varchar): Preferred mailing full name.
- FULLADDRESS (varchar): Full address. Use for address-based queries.
- HOMETELEPHONE (varchar): Home telephone. Use for phone-based queries.
- EMAIL (varchar): Email address. Use for email-based queries.
`



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
  c.FULLNAME AS \`Full Name\`,
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
  c.FULLNAME AS \`Full Name\`,
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
  c.FULLNAME AS \`Full Name\`,
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
  c.FULLNAME AS \`Full Name\`,
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
  LIMIT ${n * 10}
) dt
INNER JOIN constituents c ON c.ACCOUNTID = dt.ACCOUNTID
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
  c.FULLNAME AS \`Full Name\`,
  dt.total_amount AS \`Total Amount\`
FROM (
  SELECT g.ACCOUNTID, SUM(CAST(g.GIFTAMOUNT AS DECIMAL(15,2))) AS total_amount
  FROM gifts g
  WHERE g.GIFTDATE >= '${y}-01-01' AND g.GIFTDATE < '${y+1}-01-01'
  GROUP BY g.ACCOUNTID
  ORDER BY total_amount DESC
  LIMIT ${n * 5}
) dt
INNER JOIN constituents c ON c.ACCOUNTID = dt.ACCOUNTID
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
  c.FULLNAME AS \`Full Name\`,
  dt.total_amount AS \`Total Amount\`
FROM (
  SELECT g.ACCOUNTID, SUM(CAST(g.GIFTAMOUNT AS DECIMAL(15,2))) AS total_amount
  FROM gifts g
  WHERE g.GIFTDATE >= '${y}-01-01' AND g.GIFTDATE < '${y+1}-01-01'
  GROUP BY g.ACCOUNTID
  ORDER BY total_amount DESC
  LIMIT ${n * 5}
) dt
INNER JOIN constituents c ON c.ACCOUNTID = dt.ACCOUNTID
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
       c.FULLNAME AS \`Full Name\`,
       CAST(g.GIFTAMOUNT AS DECIMAL(15,2)) AS \`Gift Amount\`,
       g.GIFTDATE AS \`Gift Date\`
FROM gifts g
INNER JOIN constituents c ON c.ACCOUNTID = g.ACCOUNTID
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
  c.FULLNAME AS \`Full Name\`,
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
  LIMIT ${n * 5}
) dt
INNER JOIN constituents c ON c.ACCOUNTID = dt.ACCOUNTID
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
  c.FULLNAME AS \`Full Name\`,
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
  LIMIT ${n * 5}
) dt
INNER JOIN constituents c ON c.ACCOUNTID = dt.ACCOUNTID
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
INNER JOIN constituents c ON c.ACCOUNTID = dt.ACCOUNTID
ORDER BY dt.total_amount ASC, c.FULLNAME ASC, dt.ACCOUNTID ASC
LIMIT 10
`.trim()

// DEMO MODE: Direct Natural Language to SQL Prompt
const DEMO_SQL_PROMPT = `
You are a SQL expert for a donor & gifts database. Convert natural language questions directly into MariaDB 10.11 SELECT queries.

CRITICAL RULE: ONLY use column names that are explicitly listed in the schema below. NEVER invent, guess, or hallucinate column names that are not in the provided schema.

COMPREHENSIVE DATABASE SCHEMA:
${SCHEMA_DEFINATION}

INTELLIGENT FIELD MAPPING INSTRUCTIONS:
Analyze the user's query context and intent to map terms to appropriate database fields:

1. CONTEXTUAL UNDERSTANDING:
   - Read the schema descriptions to understand field purposes
   - Consider the query context (graduation vs record creation vs gift dates)
   - Use semantic understanding rather than exact word matching
   - Infer field purposes from descriptions and examples

2. DYNAMIC FIELD SELECTION:
   - For graduation queries: Use graduation year fields (UNDERGRADUATIONYEAR1, UNDERGRADUATEGRADUATIONYEAR2, GRADUATEGRADUATIONYEAR1) with integer values
   - For gift queries: Use gift-related fields (GIFTDATE, GIFTAMOUNT, etc.)
   - For contact queries: Use contact fields (EMAIL, HOMETELEPHONE, etc.)
   - For demographic queries: Use demographic fields (AGE, GENDER, etc.)

3. SEMANTIC MAPPING:
   - "donors" = constituents (people who give gifts)
   - "customers" = constituents (people in the database)
   - "graduated in YEAR" = check all graduation year fields
   - "top donors" = aggregate by ACCOUNTID and sum gift amounts
   - "top donations" = individual gift amounts (no aggregation)
   - "campaigns" = SOURCECODE or APPEAL fields
   - "funds" = DESIGNATION field
   - "last year" = previous calendar year
   - "this year" = current calendar year

4. USER ALIAS HANDLING:
   - When users provide aliases (e.g., "show me the customer names"), map to actual schema fields
   - "customer names" → c.FULLNAME (not "customer names")
   - "donor IDs" → c.ACCOUNTID (not "donor IDs")
   - "gift amounts" → g.GIFTAMOUNT (not "gift amounts")
   - "phone numbers" → c.HOMETELEPHONE (not "phone numbers")
   - Always use the actual schema column names in SQL, not user-provided aliases

5. ERROR PREVENTION:
   - Always verify field existence in the schema before using
   - Use appropriate data types (dates for dates, numbers for amounts)
   - Handle NULL values appropriately
   - Consider field relationships and constraints

INTELLIGENT SQL GENERATION RULES:

1. QUERY ANALYSIS:
   - Analyze the user's intent from the natural language query
   - Determine if this is a gift query, constituent query, or combined query
   - Identify the appropriate fields based on context and schema descriptions
   - Choose the right table joins based on the query requirements

2. FIELD SELECTION:
   - CRITICAL: ONLY use fields that exist in the provided schema above
   - Use schema descriptions to select appropriate fields
   - For graduation queries: Use graduation year fields (UNDERGRADUATIONYEAR1, UNDERGRADUATEGRADUATIONYEAR2, GRADUATEGRADUATIONYEAR1) with integer values, not DATEADDED
   - For gift queries: Use gift-related fields (GIFTDATE, GIFTAMOUNT, etc.)
   - For demographic queries: Use demographic fields (AGE, GENDER, etc.)
   - Always verify field existence in the provided schema

3. JOIN STRATEGY:
   - Use INNER JOIN when both tables are needed: FROM gifts g INNER JOIN constituents c ON g.ACCOUNTID = c.ACCOUNTID
   - Use single table when only one table's data is needed
   - Consider the query context to determine necessary joins

4. AGGREGATION LOGIC:
   - "Top donors" = GROUP BY ACCOUNTID, SUM gift amounts, ORDER BY total DESC
   - "Top donations" = Individual gifts, ORDER BY amount DESC (no GROUP BY)
   - Use appropriate aggregation functions based on query intent

5. DATA HANDLING:
   - Handle NULL values with COALESCE or appropriate NULL checks
   - Use proper data type casting: CAST(g.GIFTAMOUNT AS DECIMAL(15,2))
   - Format dates correctly: year 2021 → g.GIFTDATE >= '2021-01-01' AND g.GIFTDATE < '2022-01-01'
   - ALWAYS use human-readable aliases for ALL columns in SELECT statements
   - Column alias examples:
     * c.ACCOUNTID AS 'Account ID'
     * g.GIFTID AS 'Gift ID' 
     * g.GIFTDATE AS 'Gift Date'
     * g.GIFTAMOUNT AS 'Gift Amount'
     * g.TRANSACTIONTYPE AS 'Transaction Type'
     * g.GIFTTYPE AS 'Gift Type'
     * c.FULLNAME AS 'Full Name'
     * c.EMAIL AS 'Email'
     * c.HOMETELEPHONE AS 'Phone'
     * c.FULLADDRESS AS 'Address'
     * c.GENDER AS 'Gender'
     * c.AGE AS 'Age'

6. OUTPUT REQUIREMENTS:
   - Output ONLY valid SQL - no explanations, no comments, no semicolons
   - Always include LIMIT clause (default 10 if not specified, max 100)
   - Ensure SQL is syntactically correct for MariaDB 10.11
   - MANDATORY: Use human-readable aliases for ALL columns (e.g., c.ACCOUNTID AS 'Account ID')
   - NEVER use raw database column names in SELECT statements without aliases

7. DYNAMIC VALIDATION & ERROR RECOVERY:
   - CRITICAL: ONLY use column names that exist in the provided schema above
   - NEVER invent, guess, or hallucinate column names that are not explicitly listed
   - Before using any field, verify it exists in the provided schema
   - If a requested field doesn't exist, find the closest semantic match from the actual schema
   - If no match exists, gracefully omit the field and continue
   - Use schema context to infer field purposes and relationships
   - Handle ambiguous terms by considering query context

8. CONTEXT-AWARE FIELD MAPPING:
   - "graduated in YEAR" → Use graduation year fields (UNDERGRADUATIONYEAR1 = YEAR, UNDERGRADUATEGRADUATIONYEAR2 = YEAR, GRADUATEGRADUATIONYEAR1 = YEAR)
   - "record created" → Use DATEADDED field
   - "gift date" → Use GIFTDATE field
   - "donor information" → Use constituent fields
   - "gift information" → Use gift fields
   - "contact information" → Use contact fields (EMAIL, HOMETELEPHONE, etc.)

9. GRADUATE YEAR SPECIFIC RULES:
   - When user mentions "Graduate Year" in column selection or query context, ONLY use GRADUATEGRADUATIONYEAR1
   - NEVER use GRADUATEGRADUATIONYEAR2 for graduate year queries
   - For undergraduate queries, use UNDERGRADUATIONYEAR1 and UNDERGRADUATEGRADUATIONYEAR2
   - For graduate queries, use ONLY GRADUATEGRADUATIONYEAR1
   - Example: "Include only columns: Graduate Year, Full Name" → SELECT c.GRADUATEGRADUATIONYEAR1 AS 'Graduate Year', c.FULLNAME AS 'Full Name'

10. INTELLIGENT QUERY CONSTRUCTION:
    - Analyze the full query context to determine appropriate fields
    - Use semantic understanding rather than exact word matching
    - Map user aliases to actual schema column names (e.g., "customer names" → c.FULLNAME)
    - Consider field relationships and data types
    - Apply appropriate filters and conditions based on context
    - Choose the right aggregation strategy based on query intent

11. FALLBACK STRATEGIES:
    - If a field doesn't exist, try alternative interpretations
    - If a join fails, consider single-table queries
    - If aggregation is unclear, default to appropriate grouping
    - Always ensure the query returns meaningful results
- COLUMN MAPPING: Map user-friendly names to actual database columns (e.g., "Account ID" → c.ACCOUNTID, "Full Name" → c.FULLNAME).
- Handle missing names: COALESCE(NULLIF(TRIM(c.FULLNAME), ''), CONCAT('[Account ', dt.ACCOUNTID, ']')) AS 'Full Name'

INTELLIGENT QUERY EXAMPLES:

1. GRADUATION QUERIES:
   - "donors who graduated in 2020" → Use graduation year fields (UNDERGRADUATIONYEAR1 = 2020, UNDERGRADUATEGRADUATIONYEAR2 = 2020, GRADUATEGRADUATIONYEAR1 = 2020)
   - "alumni from 2015" → Use graduation year fields, not DATEADDED
   - "undergraduate alumni" → Use ALUMNITYPE = 'UGRD' and undergraduate graduation fields
   - "graduate alumni" → Use ALUMNITYPE = 'GRAD' and GRADUATEGRADUATIONYEAR1 only
   - "Include only columns: Graduate Year, Full Name" → SELECT c.GRADUATEGRADUATIONYEAR1 AS 'Graduate Year', c.FULLNAME AS 'Full Name'
   - "Show me graduate year and donor names" → SELECT c.GRADUATEGRADUATIONYEAR1 AS 'Graduate Year', c.FULLNAME AS 'Full Name'

2. GIFT QUERIES:
   - "top donors of 2021" → Aggregate by ACCOUNTID, sum gift amounts, filter by GIFTDATE
   - "gifts over $1000" → Filter by GIFTAMOUNT > 1000
   - "recurring gifts" → Filter by GIFTTYPE = 'Recurring'

3. DEMOGRAPHIC QUERIES:
   - "male donors" → Use GENDER = 'M'
   - "donors over 65" → Use AGE > 65
   - "volunteers" → Use VOLUNTEER field

4. CONTACT QUERIES:
   - "donors with email" → Filter by EMAIL IS NOT NULL
   - "donors in California" → Use FULLADDRESS field with LIKE '%CA%'
   - "phone numbers" → Use HOMETELEPHONE field

5. COMPLEX QUERIES:
   - "top 10 donors who graduated in 2020 and gave over $500" → Combine graduation year fields, gift amount filter, and aggregation
   - "alumni volunteers from engineering school" → Use graduation fields, volunteer status, and school fields

6. COLUMN ALIAS EXAMPLES:
   - "show me donations" → SELECT g.GIFTID AS 'Gift ID', g.GIFTAMOUNT AS 'Gift Amount', g.GIFTDATE AS 'Gift Date', g.TRANSACTIONTYPE AS 'Transaction Type'
   - "show me donors" → SELECT c.ACCOUNTID AS 'Account ID', c.FULLNAME AS 'Full Name', c.EMAIL AS 'Email', c.HOMETELEPHONE AS 'Phone'
   - "show me gifts with donor info" → SELECT c.FULLNAME AS 'Donor Name', g.GIFTAMOUNT AS 'Gift Amount', g.GIFTDATE AS 'Gift Date', g.SOURCECODE AS 'Source Code'
   - "show me male donors" → SELECT c.FULLNAME AS 'Full Name', c.GENDER AS 'Gender', c.AGE AS 'Age'

7. USER ALIAS MAPPING EXAMPLES:
   - "show me customer names" → SELECT c.FULLNAME AS 'Customer Names' (use c.FULLNAME, not "customer names")
   - "show me donor IDs" → SELECT c.ACCOUNTID AS 'Donor IDs' (use c.ACCOUNTID, not "donor IDs")
   - "show me gift amounts" → SELECT g.GIFTAMOUNT AS 'Gift Amounts' (use g.GIFTAMOUNT, not "gift amounts")
   - "show me phone numbers" → SELECT c.HOMETELEPHONE AS 'Phone Numbers' (use c.HOMETELEPHONE, not "phone numbers")
   - "show me email addresses" → SELECT c.EMAIL AS 'Email Addresses' (use c.EMAIL, not "email addresses")
   - "Include only columns: Graduate Year" → SELECT c.GRADUATEGRADUATIONYEAR1 AS 'Graduate Year' (use c.GRADUATEGRADUATIONYEAR1, not "Graduate Year")
   - "Show me Graduate Year and Full Name" → SELECT c.GRADUATEGRADUATIONYEAR1 AS 'Graduate Year', c.FULLNAME AS 'Full Name'

The AI should analyze each query contextually and select the most appropriate fields based on the schema descriptions and query intent.

KEY PRINCIPLES:
- CRITICAL: ONLY use column names that exist in the provided schema - NEVER hallucinate or invent field names
- Map user aliases to actual schema column names (e.g., "customer names" → c.FULLNAME, not "customer names")
- GRADUATE YEAR RULE: When user mentions "Graduate Year", ONLY use GRADUATEGRADUATIONYEAR1, NEVER use GRADUATEGRADUATIONYEAR2
- Use schema descriptions to understand field purposes and relationships
- Apply contextual understanding to map user terms to appropriate database fields
- Handle ambiguous terms by considering the full query context
- Gracefully handle missing or invalid fields by finding alternatives or omitting them
- Ensure all generated SQL is syntactically correct and returns meaningful results
- Use appropriate data types, joins, and aggregation strategies based on query intent
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
