// File: app/api/generate-sql/route.ts
// DEMO MODE: Simplified direct natural language to SQL conversion (intent extraction commented out)
import { NextRequest, NextResponse } from 'next/server'
import { openai as openaiConfig, features, app } from '@/lib/config'
import { rateLimiters, createRateLimitHeaders, checkRateLimit } from '@/lib/rate-limiter'
import { findMatchingTemplate } from '@/lib/query-templates'

// ---------- Intent Types & Helpers ----------

type SortField = 'satisfaction' | 'experience' | 'patient_load' | 'overtime' | 'department'
type SortDir = 'asc' | 'desc'
type Operation =
  | 'top_staff'
  | 'list_staff'
  | 'department_stats'
  | 'satisfaction_analysis'
  | 'aggregate'
  | 'explain_schema'

type Intent = {
  operation: Operation
  limit?: number | null
  filters?: {
    department?: string | null
    satisfaction?: { min?: number | null; max?: number | null } | null
    experience?: { min?: number | null; max?: number | null } | null
    patient_load?: { min?: number | null; max?: number | null } | null
    overtime?: { min?: number | null; max?: number | null } | null
  } | null
  sort?: Array<{ field: SortField; direction: SortDir }> | null
  include?: string[] | null
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



const SCHEMA_DEFINATION = `Table: healthstaff_schedule
- Staff_ID (nvarchar): Primary key - unique identifier for each staff member.
- Department (nvarchar): Department where the staff member works (e.g., Pediatrics, General Medicine, ICU, ER). Use for department-based queries and filtering.
- Shift_Duration_Hours (int): Number of hours worked per shift. Use for shift analysis and workload queries.
- Patient_Load (int): Number of patients assigned to the staff member. Use for patient load analysis and capacity planning.
- Workdays_per_Month (int): Number of work days per month. Use for monthly workload analysis.
- Overtime_Hours (int): Number of overtime hours worked. Use for overtime analysis and cost management.
- Years_of_Experience (int): Years of professional experience. Use for experience-based queries and seniority analysis.
- Absenteeism_Days (int): Number of days absent. Use for attendance analysis and productivity metrics.
- Satisfaction_Score (decimal): Current satisfaction rating (typically 1-5 scale). Use for satisfaction analysis and performance metrics.
- Previous_Satisfaction_Rating (decimal): Previous satisfaction rating for comparison. Use for satisfaction trend analysis.

This table contains healthcare staff scheduling and performance data with 1000 records across different departments.
Use this data for healthcare workforce analytics, staff performance analysis, department comparisons, and operational insights.
`



const SCHEMA_TEXT = `
SQL Server Database Schema:
- healthstaff_schedule (alias h): Staff_ID, Department, Shift_Duration_Hours, Patient_Load, Workdays_per_Month, Overtime_Hours, Years_of_Experience, Absenteeism_Days, Satisfaction_Score, Previous_Satisfaction_Rating

This is a single table database with healthcare staff data.
`.trim()

// ---------- Fast Path Router ----------

function fastPathSQL(q: string): string | null {
  // Pattern 1: "top N staff by FIELD" (with various sorting options)
  const m1 = q.match(/\btop\s+(\d+)\s+staff\s+by\s+(\w+)(?:\s+in\s+(?:ascending|descending)\s+order)?\b/i)
  if (m1) {
    const n = Math.min(parseInt(m1[1],10), 100)
    const sortField = m1[2]
    
    // Check if it's descending order
    const isDesc = /\bdescending\b/i.test(q)
    const sortOrder = isDesc ? 'DESC' : 'ASC'
    
    // Determine what columns to include and how to sort
    let selectColumns = ''
    let orderByClause = ''
    
    switch (sortField?.toLowerCase()) {
      case 'satisfaction':
      case 'satisfaction_score':
        selectColumns = `
  h.Staff_ID AS 'Staff ID',
  h.Department AS 'Department',
  h.Satisfaction_Score AS 'Satisfaction Score',
  h.Patient_Load AS 'Patient Load'`
        orderByClause = `
  h.Satisfaction_Score ${sortOrder},
  h.Staff_ID ASC`
        break
        
      case 'experience':
      case 'years_of_experience':
        selectColumns = `
  h.Staff_ID AS 'Staff ID',
  h.Department AS 'Department',
  h.Years_of_Experience AS 'Years of Experience',
  h.Satisfaction_Score AS 'Satisfaction Score'`
        orderByClause = `
  h.Years_of_Experience ${sortOrder},
  h.Staff_ID ASC`
        break
        
      case 'patient_load':
      case 'patients':
        selectColumns = `
  h.Staff_ID AS 'Staff ID',
  h.Department AS 'Department',
  h.Patient_Load AS 'Patient Load',
  h.Satisfaction_Score AS 'Satisfaction Score'`
        orderByClause = `
  h.Patient_Load ${sortOrder},
  h.Staff_ID ASC`
        break
        
      case 'overtime':
      case 'overtime_hours':
        selectColumns = `
  h.Staff_ID AS 'Staff ID',
  h.Department AS 'Department',
  h.Overtime_Hours AS 'Overtime Hours',
  h.Satisfaction_Score AS 'Satisfaction Score'`
        orderByClause = `
  h.Overtime_Hours ${sortOrder},
  h.Staff_ID ASC`
        break
        
      default:
        // For unknown sort fields, default to satisfaction sorting
        selectColumns = `
  h.Staff_ID AS 'Staff ID',
  h.Department AS 'Department',
  h.Satisfaction_Score AS 'Satisfaction Score',
  h.Patient_Load AS 'Patient Load'`
        orderByClause = `
  h.Satisfaction_Score ${sortOrder},
  h.Staff_ID ASC`
    }
    
    return `
SELECT TOP ${n}${selectColumns}
FROM healthstaff_schedule h
ORDER BY${orderByClause}`.trim()
  }
  
  // Pattern 2: "top N staff" (basic, no specific sorting)
  const m2 = q.match(/\btop\s+(\d+)\s+staff\b/i)
  if (m2 && !q.match(/\b(?:and\s+)?(?:sort|by|satisfaction|experience|patient|overtime|department)\b/i)) {
    const n = Math.min(parseInt(m2[1],10), 100)
    return `
SELECT TOP ${n}
  h.Staff_ID AS 'Staff ID',
  h.Department AS 'Department',
  h.Satisfaction_Score AS 'Satisfaction Score',
  h.Patient_Load AS 'Patient Load'
FROM healthstaff_schedule h
ORDER BY
  h.Satisfaction_Score DESC,
  h.Staff_ID ASC`.trim()
  }
  
  // Pattern 2b: "show me top staff" (without explicit number, defaults to 10)
  const m2b = q.match(/\b(?:show\s+me\s+)?top\s+staff\b/i)
  if (m2b && !q.match(/\b(?:and\s+)?(?:sort|by|satisfaction|experience|patient|overtime|department)\b/i)) {
    const n = 10 // Default limit
    return `
SELECT TOP ${n}
  h.Staff_ID AS 'Staff ID',
  h.Department AS 'Department',
  h.Satisfaction_Score AS 'Satisfaction Score',
  h.Patient_Load AS 'Patient Load'
FROM healthstaff_schedule h
ORDER BY
  h.Satisfaction_Score DESC,
  h.Staff_ID ASC`.trim()
  }
  
  // Pattern 3: "staff by department"
  const m3 = q.match(/\bstaff\s+by\s+department\s+(\w+)\b/i)
  if (m3) {
    const department = m3[1]
    return `
SELECT TOP 50
  h.Staff_ID AS 'Staff ID',
  h.Department AS 'Department',
  h.Satisfaction_Score AS 'Satisfaction Score',
  h.Patient_Load AS 'Patient Load',
  h.Years_of_Experience AS 'Years of Experience'
FROM healthstaff_schedule h
WHERE h.Department = '${department}'
ORDER BY 
  h.Satisfaction_Score DESC,
  h.Staff_ID ASC`.trim()
  }

  // Pattern 4: "average satisfaction by department"
  const m4 = q.match(/\baverage\s+satisfaction\s+by\s+department\b/i)
  if (m4) {
    return `
SELECT
  h.Department AS 'Department',
  AVG(h.Satisfaction_Score) AS 'Average Satisfaction',
  COUNT(h.Staff_ID) AS 'Staff Count',
  AVG(h.Patient_Load) AS 'Average Patient Load'
FROM healthstaff_schedule h
WHERE h.Department IS NOT NULL
GROUP BY h.Department
ORDER BY
  AVG(h.Satisfaction_Score) DESC,
  h.Department ASC`.trim()
  }

  // Pattern 4b: "department statistics"
  const m4b = q.match(/\bdepartment\s+statistics\b/i)
  if (m4b) {
    return `
SELECT
  h.Department AS 'Department',
  COUNT(h.Staff_ID) AS 'Staff Count',
  AVG(h.Satisfaction_Score) AS 'Average Satisfaction',
  AVG(h.Patient_Load) AS 'Average Patient Load',
  AVG(h.Years_of_Experience) AS 'Average Experience',
  AVG(h.Overtime_Hours) AS 'Average Overtime'
FROM healthstaff_schedule h
WHERE h.Department IS NOT NULL
GROUP BY h.Department
ORDER BY
  AVG(h.Satisfaction_Score) DESC,
  h.Department ASC`.trim()
  }

  // Pattern 5: "correlation between" queries
  const m5 = q.match(/\bcorrelation\s+between\s+(\w+)\s+and\s+(\w+)\b/i)
  if (m5) {
    const field1 = m5[1].toLowerCase()
    const field2 = m5[2].toLowerCase()
    
    let field1Col = ''
    let field2Col = ''
    
    if (field1.includes('experience') || field1.includes('years')) {
      field1Col = 'h.Years_of_Experience'
    } else if (field1.includes('satisfaction')) {
      field1Col = 'h.Satisfaction_Score'
    } else if (field1.includes('overtime')) {
      field1Col = 'h.Overtime_Hours'
    } else if (field1.includes('patient') || field1.includes('load')) {
      field1Col = 'h.Patient_Load'
    } else if (field1.includes('absenteeism')) {
      field1Col = 'h.Absenteeism_Days'
    }
    
    if (field2.includes('experience') || field2.includes('years')) {
      field2Col = 'h.Years_of_Experience'
    } else if (field2.includes('satisfaction')) {
      field2Col = 'h.Satisfaction_Score'
    } else if (field2.includes('overtime')) {
      field2Col = 'h.Overtime_Hours'
    } else if (field2.includes('patient') || field2.includes('load')) {
      field2Col = 'h.Patient_Load'
    } else if (field2.includes('absenteeism')) {
      field2Col = 'h.Absenteeism_Days'
    }
    
    if (field1Col && field2Col) {
      return `
SELECT TOP 50
  h.Staff_ID AS 'Staff ID',
  h.Department AS 'Department',
  ${field1Col} AS '${field1.charAt(0).toUpperCase() + field1.slice(1)}',
  ${field2Col} AS '${field2.charAt(0).toUpperCase() + field2.slice(1)}'
FROM healthstaff_schedule h
WHERE ${field1Col} IS NOT NULL AND ${field2Col} IS NOT NULL
ORDER BY ${field1Col} DESC`.trim()
    }
  }

  // Pattern 6: "relationship between" queries
  const m6 = q.match(/\brelationship\s+between\s+(\w+)\s+and\s+(\w+)\b/i)
  if (m6) {
    const field1 = m6[1].toLowerCase()
    const field2 = m6[2].toLowerCase()
    
    let field1Col = ''
    let field2Col = ''
    
    if (field1.includes('overtime')) {
      field1Col = 'h.Overtime_Hours'
    } else if (field1.includes('satisfaction')) {
      field1Col = 'h.Satisfaction_Score'
    } else if (field1.includes('patient') || field1.includes('load')) {
      field1Col = 'h.Patient_Load'
    } else if (field1.includes('absenteeism')) {
      field1Col = 'h.Absenteeism_Days'
    }
    
    if (field2.includes('overtime')) {
      field2Col = 'h.Overtime_Hours'
    } else if (field2.includes('satisfaction')) {
      field2Col = 'h.Satisfaction_Score'
    } else if (field2.includes('patient') || field2.includes('load')) {
      field2Col = 'h.Patient_Load'
    } else if (field2.includes('absenteeism')) {
      field2Col = 'h.Absenteeism_Days'
    }
    
    if (field1Col && field2Col) {
      return `
SELECT TOP 50
  h.Staff_ID AS 'Staff ID',
  h.Department AS 'Department',
  ${field1Col} AS '${field1.charAt(0).toUpperCase() + field1.slice(1)}',
  ${field2Col} AS '${field2.charAt(0).toUpperCase() + field2.slice(1)}'
FROM healthstaff_schedule h
WHERE ${field1Col} IS NOT NULL AND ${field2Col} IS NOT NULL
ORDER BY ${field1Col} DESC`.trim()
    }
  }

  // Pattern 7: "departments with" complex conditions
  const m7 = q.match(/\bdepartments?\s+with\s+(.+?)\s+and\s+(.+?)\b/i)
  if (m7) {
    const condition1 = m7[1].toLowerCase()
    const condition2 = m7[2].toLowerCase()
    
    let whereClause = ''
    
    if (condition1.includes('overtime') && condition1.includes('above')) {
      const hours = condition1.match(/(\d+)/)?.[1] || '10'
      whereClause += `AVG(h.Overtime_Hours) > ${hours}`
    }
    if (condition1.includes('satisfaction') && condition1.includes('below')) {
      const score = condition1.match(/(\d+)/)?.[1] || '3'
      whereClause += `AVG(h.Satisfaction_Score) < ${score}`
    }
    if (condition1.includes('patient') && condition1.includes('above')) {
      const load = condition1.match(/(\d+)/)?.[1] || '20'
      whereClause += `AVG(h.Patient_Load) > ${load}`
    }
    
    if (condition2.includes('overtime') && condition2.includes('above')) {
      const hours = condition2.match(/(\d+)/)?.[1] || '10'
      whereClause += whereClause ? ` AND AVG(h.Overtime_Hours) > ${hours}` : `AVG(h.Overtime_Hours) > ${hours}`
    }
    if (condition2.includes('satisfaction') && condition2.includes('below')) {
      const score = condition2.match(/(\d+)/)?.[1] || '3'
      whereClause += whereClause ? ` AND AVG(h.Satisfaction_Score) < ${score}` : `AVG(h.Satisfaction_Score) < ${score}`
    }
    if (condition2.includes('patient') && condition2.includes('above')) {
      const load = condition2.match(/(\d+)/)?.[1] || '20'
      whereClause += whereClause ? ` AND AVG(h.Patient_Load) > ${load}` : `AVG(h.Patient_Load) > ${load}`
    }
    
    if (whereClause) {
      return `
SELECT
  h.Department AS 'Department',
  COUNT(h.Staff_ID) AS 'Staff Count',
  AVG(h.Satisfaction_Score) AS 'Average Satisfaction',
  AVG(h.Overtime_Hours) AS 'Average Overtime',
  AVG(h.Patient_Load) AS 'Average Patient Load'
FROM healthstaff_schedule h
WHERE h.Department IS NOT NULL
GROUP BY h.Department
HAVING ${whereClause}
ORDER BY AVG(h.Satisfaction_Score) DESC`.trim()
    }
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
- FULLNAME display (CRITICAL): Use COALESCE(NULLIF(TRIM(c.FULLNAME), ''), CONCAT('[Account ', ACCOUNTID, ']')) AS 'Full Name' to handle missing/empty names.
  - AGE display:
  CASE WHEN TRIM(c.AGE) IS NOT NULL AND TRIM(c.AGE) != '' AND CAST(NULLIF(TRIM(c.AGE), '') AS UNSIGNED) IS NOT NULL
       THEN CAST(NULLIF(TRIM(c.AGE), '') AS UNSIGNED)
       ELSE NULL END AS 'Age'
  - ALWAYS include dt.total_amount AS 'Total Amount' in donor queries (top_donors, list_donors).
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
SELECT c.FULLNAME AS 'Full Name', dt.total_amount AS 'Total Amount'
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
You are a SQL expert for a healthcare staff database. Convert natural language questions directly into SQL Server SELECT queries.

CRITICAL RULES:
1. ONLY use column names that are explicitly listed in the schema below. NEVER invent, guess, or hallucinate column names that are not in the provided schema.
2. EVERY SELECT statement MUST include TOP clause (default 10, max 100). NO EXCEPTIONS.
3. Use SQL Server syntax (TOP, not LIMIT).

COMPREHENSIVE DATABASE SCHEMA:
${SCHEMA_DEFINATION}

INTELLIGENT FIELD MAPPING INSTRUCTIONS:
Analyze the user's query context and intent to map terms to appropriate database fields:

1. CONTEXTUAL UNDERSTANDING:
   - Read the schema descriptions to understand field purposes
   - Consider the query context (staff performance, department analysis, satisfaction metrics)
   - Use semantic understanding rather than exact word matching
   - Infer field purposes from descriptions and examples

2. DYNAMIC FIELD SELECTION:
   - For staff queries: Use staff-related fields (Staff_ID, Department, Satisfaction_Score, etc.)
   - For department queries: Use Department field for grouping and filtering
   - For performance queries: Use satisfaction, experience, and workload fields
   - For workload queries: Use Patient_Load, Shift_Duration_Hours, Overtime_Hours

3. SEMANTIC MAPPING:
   - "staff" = healthstaff_schedule table
   - "employees" = healthstaff_schedule table
   - "workers" = healthstaff_schedule table
   - "top staff" = ORDER BY satisfaction or performance metrics
   - "department analysis" = GROUP BY Department
   - "satisfaction" = Satisfaction_Score field
   - "experience" = Years_of_Experience field
   - "workload" = Patient_Load or Shift_Duration_Hours
   - "overtime" = Overtime_Hours field
   - "absenteeism" = Absenteeism_Days field
   - "correlation" = Show relationship between two fields
   - "relationship between" = Compare two fields side by side
   - "departments with" = Filter departments by conditions using HAVING
   - "overworked" = High Patient_Load or Overtime_Hours
   - "happiest staff" = Highest Satisfaction_Score
   - "most experienced" = Highest Years_of_Experience
   - "pressure" = High Patient_Load per shift
   - "drop in satisfaction" = Compare Satisfaction_Score vs Previous_Satisfaction_Rating

4. USER ALIAS HANDLING:
   - When users provide aliases, map to actual schema fields
   - "staff names" → h.Staff_ID (not "staff names")
   - "employee IDs" → h.Staff_ID (not "employee IDs")
   - "satisfaction scores" → h.Satisfaction_Score (not "satisfaction scores")
   - "patient loads" → h.Patient_Load (not "patient loads")
   - Always use the actual schema column names in SQL, not user-provided aliases

5. ERROR PREVENTION:
   - Always verify field existence in the schema before using
   - Use appropriate data types (decimal for scores, int for counts)
   - Handle NULL values appropriately
   - Consider field relationships and constraints

INTELLIGENT SQL GENERATION RULES:

1. QUERY ANALYSIS:
   - Analyze the user's intent from the natural language query
   - Determine if this is a staff listing, department analysis, or performance query
   - Identify the appropriate fields based on context and schema descriptions
   - Choose the right aggregation strategy based on query requirements

2. FIELD SELECTION:
   - CRITICAL: ONLY use fields that exist in the provided schema above
   - Use schema descriptions to select appropriate fields
   - For staff queries: Use Staff_ID, Department, Satisfaction_Score, etc.
   - For department analysis: Use Department for grouping, aggregate other fields
   - For performance queries: Use satisfaction, experience, and workload fields
   - Always verify field existence in the provided schema

3. AGGREGATION LOGIC:
   - "Top staff" = ORDER BY satisfaction or performance metrics DESC
   - "Department statistics" = GROUP BY Department, aggregate other fields
   - "Average satisfaction" = AVG(Satisfaction_Score) with GROUP BY
   - Use appropriate aggregation functions based on query intent

4. DATA HANDLING:
   - Handle NULL values with appropriate NULL checks
   - Use proper data type casting for decimal fields
   - ALWAYS use human-readable aliases for ALL columns in SELECT statements
   - Column alias examples:
     * h.Staff_ID AS 'Staff ID'
     * h.Department AS 'Department'
     * h.Satisfaction_Score AS 'Satisfaction Score'
     * h.Patient_Load AS 'Patient Load'
     * h.Years_of_Experience AS 'Years of Experience'
     * h.Overtime_Hours AS 'Overtime Hours'
     * h.Shift_Duration_Hours AS 'Shift Duration Hours'
     * h.Workdays_per_Month AS 'Workdays per Month'
     * h.Absenteeism_Days AS 'Absenteeism Days'
     * h.Previous_Satisfaction_Rating AS 'Previous Satisfaction Rating'

5. OUTPUT REQUIREMENTS:
   - Output ONLY valid SQL - no explanations, no comments, no semicolons
   - MANDATORY: Always include TOP clause (default 10 if not specified, max 100)
   - Ensure SQL is syntactically correct for SQL Server
   - MANDATORY: Use human-readable aliases for ALL columns (e.g., h.Staff_ID AS 'Staff ID')
   - NEVER use raw database column names in SELECT statements without aliases
   - Use TOP instead of LIMIT for SQL Server compatibility
   - CRITICAL: Every SELECT statement MUST have TOP clause - no exceptions

6. DYNAMIC VALIDATION & ERROR RECOVERY:
   - CRITICAL: ONLY use column names that exist in the provided schema above
   - NEVER invent, guess, or hallucinate column names that are not explicitly listed
   - Before using any field, verify it exists in the provided schema
   - If a requested field doesn't exist, find the closest semantic match from the actual schema
   - If no match exists, gracefully omit the field and continue
   - Use schema context to infer field purposes and relationships
   - Handle ambiguous terms by considering query context

7. CONTEXT-AWARE FIELD MAPPING:
   - "staff performance" → Use satisfaction and experience fields
   - "department analysis" → Use Department field for grouping
   - "workload analysis" → Use Patient_Load and Shift_Duration_Hours
   - "overtime analysis" → Use Overtime_Hours field
   - "attendance analysis" → Use Absenteeism_Days field

8. INTELLIGENT QUERY CONSTRUCTION:
    - Analyze the full query context to determine appropriate fields
    - Use semantic understanding rather than exact word matching
    - Map user aliases to actual schema column names (e.g., "staff names" → h.Staff_ID)
    - Consider field relationships and data types
    - Apply appropriate filters and conditions based on context
    - Choose the right aggregation strategy based on query intent

9. FALLBACK STRATEGIES:
    - If a field doesn't exist, try alternative interpretations
    - If aggregation is unclear, default to appropriate grouping
    - Always ensure the query returns meaningful results

INTELLIGENT QUERY EXAMPLES:

1. STAFF QUERIES:
   - "top 10 staff by satisfaction" → SELECT TOP 10 h.Staff_ID AS 'Staff ID', h.Department AS 'Department', h.Satisfaction_Score AS 'Satisfaction Score' FROM healthstaff_schedule h ORDER BY h.Satisfaction_Score DESC
   - "staff with high experience" → Use Years_of_Experience field
   - "staff by department" → GROUP BY Department
   - "staff in pediatrics department" → SELECT TOP 10 h.Staff_ID AS 'Staff ID', h.Department AS 'Department', h.Satisfaction_Score AS 'Satisfaction Score' FROM healthstaff_schedule h WHERE h.Department = 'Pediatrics'

2. DEPARTMENT ANALYSIS:
   - "average satisfaction by department" → GROUP BY Department, AVG(Satisfaction_Score)
   - "department statistics" → GROUP BY Department with multiple aggregations
   - "staff count by department" → GROUP BY Department, COUNT(Staff_ID)

3. PERFORMANCE QUERIES:
   - "high performing staff" → ORDER BY Satisfaction_Score DESC
   - "staff with overtime" → Filter by Overtime_Hours > 0
   - "experienced staff" → ORDER BY Years_of_Experience DESC

4. WORKLOAD QUERIES:
   - "staff with high patient load" → ORDER BY Patient_Load DESC
   - "overtime analysis" → GROUP BY Department, AVG(Overtime_Hours)
   - "shift duration analysis" → Use Shift_Duration_Hours field

5. CORRELATION & RELATIONSHIP QUERIES:
   - "correlation between years of experience and satisfaction" → SELECT TOP 50 h.Staff_ID AS 'Staff ID', h.Department AS 'Department', h.Years_of_Experience AS 'Years of Experience', h.Satisfaction_Score AS 'Satisfaction Score' FROM healthstaff_schedule h WHERE h.Years_of_Experience IS NOT NULL AND h.Satisfaction_Score IS NOT NULL ORDER BY h.Years_of_Experience DESC
   - "relationship between overtime hours and satisfaction score" → SELECT TOP 50 h.Staff_ID AS 'Staff ID', h.Department AS 'Department', h.Overtime_Hours AS 'Overtime Hours', h.Satisfaction_Score AS 'Satisfaction Score' FROM healthstaff_schedule h WHERE h.Overtime_Hours IS NOT NULL AND h.Satisfaction_Score IS NOT NULL ORDER BY h.Overtime_Hours DESC

6. COMPLEX CONDITIONAL QUERIES:
   - "staff with more than 10 overtime hours and satisfaction below 3" → SELECT TOP 50 h.Staff_ID AS 'Staff ID', h.Department AS 'Department', h.Overtime_Hours AS 'Overtime Hours', h.Satisfaction_Score AS 'Satisfaction Score' FROM healthstaff_schedule h WHERE h.Overtime_Hours > 10 AND h.Satisfaction_Score < 3
   - "departments with overtime above 8 hours and satisfaction below 3" → SELECT h.Department AS 'Department', COUNT(h.Staff_ID) AS 'Staff Count', AVG(h.Satisfaction_Score) AS 'Average Satisfaction', AVG(h.Overtime_Hours) AS 'Average Overtime' FROM healthstaff_schedule h WHERE h.Department IS NOT NULL GROUP BY h.Department HAVING AVG(h.Overtime_Hours) > 8 AND AVG(h.Satisfaction_Score) < 3 ORDER BY AVG(h.Satisfaction_Score) DESC

7. EXPERIENCE GROUPING QUERIES:
   - "average satisfaction by years of experience group" → SELECT CASE WHEN h.Years_of_Experience <= 5 THEN '0-5 years' WHEN h.Years_of_Experience <= 10 THEN '6-10 years' ELSE '10+ years' END AS 'Experience Group', AVG(h.Satisfaction_Score) AS 'Average Satisfaction', COUNT(h.Staff_ID) AS 'Staff Count' FROM healthstaff_schedule h WHERE h.Years_of_Experience IS NOT NULL GROUP BY CASE WHEN h.Years_of_Experience <= 5 THEN '0-5 years' WHEN h.Years_of_Experience <= 10 THEN '6-10 years' ELSE '10+ years' END ORDER BY AVG(h.Satisfaction_Score) DESC

8. SATISFACTION COMPARISON QUERIES:
   - "departments with largest drop in satisfaction" → SELECT h.Department AS 'Department', AVG(h.Satisfaction_Score) AS 'Current Satisfaction', AVG(h.Previous_Satisfaction_Rating) AS 'Previous Satisfaction', AVG(h.Previous_Satisfaction_Rating) - AVG(h.Satisfaction_Score) AS 'Satisfaction Drop' FROM healthstaff_schedule h WHERE h.Department IS NOT NULL AND h.Previous_Satisfaction_Rating IS NOT NULL GROUP BY h.Department ORDER BY AVG(h.Previous_Satisfaction_Rating) - AVG(h.Satisfaction_Score) DESC

5. COLUMN ALIAS EXAMPLES:
   - "show me staff" → SELECT TOP 10 h.Staff_ID AS 'Staff ID', h.Department AS 'Department', h.Satisfaction_Score AS 'Satisfaction Score' FROM healthstaff_schedule h
   - "show me departments" → SELECT h.Department AS 'Department', COUNT(h.Staff_ID) AS 'Staff Count' FROM healthstaff_schedule h GROUP BY h.Department
   - "show me performance" → SELECT TOP 10 h.Staff_ID AS 'Staff ID', h.Satisfaction_Score AS 'Satisfaction Score', h.Patient_Load AS 'Patient Load' FROM healthstaff_schedule h

6. USER ALIAS MAPPING EXAMPLES:
   - "show me staff names" → SELECT h.Staff_ID AS 'Staff Names' (use h.Staff_ID, not "staff names")
   - "show me employee IDs" → SELECT h.Staff_ID AS 'Employee IDs' (use h.Staff_ID, not "employee IDs")
   - "show me satisfaction scores" → SELECT h.Satisfaction_Score AS 'Satisfaction Scores' (use h.Satisfaction_Score, not "satisfaction scores")

The AI should analyze each query contextually and select the most appropriate fields based on the schema descriptions and query intent.

KEY PRINCIPLES:
- CRITICAL: ONLY use column names that exist in the provided schema - NEVER hallucinate or invent field names
- Map user aliases to actual schema column names (e.g., "staff names" → h.Staff_ID, not "staff names")
- Use schema descriptions to understand field purposes and relationships
- Apply contextual understanding to map user terms to appropriate database fields
- Handle ambiguous terms by considering the full query context
- Gracefully handle missing or invalid fields by finding alternatives or omitting them
- Ensure all generated SQL is syntactically correct and returns meaningful results
- Use appropriate data types, aggregation strategies based on query intent
`.trim()

// ---------- Route ----------

export async function POST(req: NextRequest) {
  try {
    if (app.isBuildTime) {
      return NextResponse.json({ error: 'Service unavailable during build' }, { status: 503 })
    }
    if (!process.env.OPENAI_API_KEY || !process.env.SARAV2_DATABASE_URL) {
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
        intent: { operation: 'top_staff', fastPath: true }
      })
      const headers = createRateLimitHeaders(rateLimitResult)
      Object.entries(headers).forEach(([k, v]) => response.headers.set(k, v))
      return response
    }

    // ---- Template check (for complex analytical queries)
    const templateResult = findMatchingTemplate(question)
    if (templateResult) {
      console.log('🎯 Template SQL generated for:', question)
      const response = NextResponse.json({ 
        sql: templateResult, 
        success: true, 
        template: true,
        processingTime: 'template',
        intent: { operation: 'analytical', template: true }
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

    // Optional: tiny sanity checks before returning (no semicolon, must start with SELECT, has TOP or LIMIT)
    if (/;/.test(sqlQuery) || !/^\s*select\b/i.test(sqlQuery) || (!/\btop\s+\d+/i.test(sqlQuery) && !/\blimit\s+\d+/i.test(sqlQuery))) {
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
