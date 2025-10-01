import { NextRequest, NextResponse } from 'next/server'
import { businessPrisma } from '@/lib/mysql-prisma'
import { executeSQLQuery } from '@/lib/sql-query'
import { features } from '@/lib/config'
import { rateLimiters, createRateLimitHeaders, checkRateLimit } from '@/lib/rate-limiter'
import { DEMO_USERS } from '@/lib/auth'

// Function to extract sorting preference from question
function extractSortPreference(question: string): 'asc' | 'desc' | undefined {
  const questionLower = question.toLowerCase()
  
  // Look for sorting keywords
  if (questionLower.includes('ascending') || questionLower.includes('asc') || 
      questionLower.includes('low to high') || questionLower.includes('smallest to largest') ||
      questionLower.includes('a to z')) {
    return 'asc'
  }
  
  if (questionLower.includes('descending') || questionLower.includes('desc') || 
      questionLower.includes('high to low') || questionLower.includes('largest to smallest') ||
      questionLower.includes('z to a')) {
    return 'desc'
  }
  
  return undefined
}

// Function to transform column names to human-readable aliases
function transformColumnsToHumanReadable(columns: any[]) {
  const aliasMapping: { [key: string]: string } = {
    'ACCOUNTID': 'Account ID',
    'GIFTID': 'Gift ID',
    'GIFTDATE': 'Gift Date',
    'GIFTAMOUNT': 'Gift Amount',
    'TRANSACTIONTYPE': 'Transaction Type',
    'GIFTTYPE': 'Gift Type',
    'PAYMENTMETHOD': 'Payment Method',
    'PLEDGEID': 'Pledge ID',
    'SOFTCREDITINDICATOR': 'Soft Credit Indicator',
    'SOFTCREDITAMOUNT': 'Soft Credit Amount',
    'SOFTCREDITID': 'Soft Credit ID',
    'SOURCECODE': 'Source Code',
    'DESIGNATION': 'Designation',
    'UNIT': 'Unit',
    'PURPOSECATEGORY': 'Purpose Category',
    'APPEAL': 'Appeal',
    'GIVINGLEVEL': 'Giving Level',
    'LOOKUPID': 'Lookup ID',
    'TYPE': 'Type',
    'DONORTYPE1': 'Donor Type',
    'PERSONORGANIZATIONINDICATOR': 'Person Organization Indicator',
    'ALUMNITYPE': 'Alumni Type',
    'UNDERGRADUATEDEGREE1': 'Undergraduate Degree',
    'UNDERGRADUATIONYEAR1': 'Undergraduate Year',
    'UNDERGRADUATEPREFERREDCLASSYEAR1': 'Undergraduate Preferred Class Year',
    'UNDERGRADUATESCHOOL1': 'Undergraduate School',
    'GRADUATEDEGREE1': 'Graduate Degree',
    'GRADUATEGRADUATIONYEAR1': 'Graduate Graduation Year',
    'GRADUATEPREFERREDCLASSYEAR1': 'Graduate Preferred Class Year',
    'GRADUATESCHOOL1': 'Graduate School',
    'GENDER': 'Gender',
    'DECEASED': 'Deceased',
    'SOLICITATIONRESTRICTIONS': 'Solicitation Restrictions',
    'DONOTMAIL': 'Do Not Mail',
    'DONOTPHONE': 'Do Not Phone',
    'DONOTEMAIL': 'Do Not Email',
    'MARRIEDTOALUM': 'Married To Alum',
    'SPOUSELOOKUPID': 'Spouse Lookup ID',
    'SPOUSEID': 'Spouse ID',
    'ASSIGNEDACCOUNT': 'Assigned Account',
    'VOLUNTEER': 'Volunteer',
    'WEALTHSCORE': 'Wealth Score',
    'GEPSTATUS': 'GEP Status',
    'EVENTSATTENDED': 'Events Attended',
    'EVENTS': 'Events',
    'AGE': 'Age',
    'FULLNAME': 'Full Name',
    'PMFULLNAME': 'PM Full Name',
    'FULLADDRESS': 'Full Address',
    'HOMETELEPHONE': 'Home Telephone',
    'EMAIL': 'Email',
    'Year': 'Year',
    'Total Amount': 'Total Amount',
    'Average Amount': 'Average Amount',
    'Gift Count': 'Gift Count',
    'Donor Name': 'Full Name', // Map old alias to new
    'Donation Amount': 'Gift Amount', // Map old alias to new
    'Source': 'Source Code', // Map old alias to new
  }

  return columns.map(column => ({
    ...column,
    name: aliasMapping[column.name] || column.name,
    key: column.key // Keep the original key for data access
  }))
}

// Helper function to get user ID from request headers
function getUserIdFromRequest(req: NextRequest): number {
  const userIdHeader = req.headers.get('x-user-id')
  if (userIdHeader) {
    const userId = parseInt(userIdHeader)
    // Verify the user exists in our demo users
    const userExists = DEMO_USERS.some(user => user.id === userId)
    return userExists ? userId : 1 // Default to user 1 if invalid
  }
  return 1 // Default to user 1 if no header
}

// Map outputMode string to int for DB (customize as needed)
const outputModeMap: Record<string, number> = {
  table: 1,
  chart: 2,
  pie: 3,
}

export async function POST(req: NextRequest) {
  console.time("🔁 TOTAL /api/query")
  
  try {
    // Apply rate limiting for query endpoints
    const rateLimitResult = checkRateLimit(req, 50, 60 * 1000) // 50 requests per minute
    
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

    const body = await req.json()

    // Create a helper to add rate limit headers to responses
    const addRateLimitHeaders = (response: NextResponse) => {
      const headers = createRateLimitHeaders(rateLimitResult)
      Object.entries(headers).forEach(([key, value]) => {
        response.headers.set(key, value)
      })
      return response
    }

    // ---- 1. Save Query Branch ----
    if (body.action === "save") {
      const userId = getUserIdFromRequest(req)
      const {
        question,
        sql,
        outputMode,
        columns,
        dataSample,
        companyId = 1,
        visualConfig = null,
        panelPosition = null,
        selectedColumns = null,
        filteredColumns = null,
      } = body

      if (!question || !sql || !outputMode || !columns) {
        return addRateLimitHeaders(
          NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 })
        )
      }

      const output_mode = outputModeMap[outputMode] || 1

      // Extract sorting preference from question
      const sortPreference = extractSortPreference(question)
      
      // Execute the query to get fresh results
      const queryResult = await executeSQLQuery(sql, question, sortPreference)
      if (!queryResult.success) {
        return addRateLimitHeaders(
          NextResponse.json({ success: false, error: queryResult.error }, { status: 400 })
        )
      }

      // Use frontend columns if provided (preserves reordering), otherwise use database columns
      const columnsToSave = columns && columns.length > 0 ? columns : queryResult.columns || []
      
      // Only transform if columns don't already have human-readable names
      const needsTransformation = columnsToSave.some((col: any) => 
        col.name && (col.name === col.key || col.name.includes('_') || col.name === col.name.toUpperCase())
      )
      const transformedColumns = needsTransformation ? transformColumnsToHumanReadable(columnsToSave) : columnsToSave
      
      const savedQuery = await businessPrisma.savedQuery.create({
        data: {
          userId,
          companyId,
          title: question,
          queryText: question,
          comboPrompt: body.comboPrompt || question, // Store combo prompt if provided, otherwise use question
          sqlText: sql,
          outputMode: output_mode,
          visualConfig: visualConfig ? JSON.stringify(visualConfig) : null,
          panelPosition,
          resultData: JSON.stringify(queryResult.rows || []),
          resultColumns: JSON.stringify(transformedColumns),
          selectedColumns: selectedColumns ? JSON.stringify(selectedColumns) : null,
          filteredColumns: filteredColumns ? JSON.stringify(filteredColumns) : null,
        },
      })

      return addRateLimitHeaders(
        NextResponse.json({ success: true, id: savedQuery.id })
      )
    }

    // ---- 2. Update Query Branch ----
    if (body.action === "update") {
      const userId = getUserIdFromRequest(req)
      const { id, title, question, sql, outputMode, columns, visualConfig, selectedColumns, filteredColumns } = body

      if (!id || !title || !question || !sql || !outputMode || !columns) {
        return addRateLimitHeaders(
          NextResponse.json({ success: false, error: 'Missing required fields for update' }, { status: 400 })
        )
      }

      // Verify the user owns this query
      const existingQuery = await businessPrisma.savedQuery.findUnique({
        where: { id: parseInt(id) },
        select: { userId: true }
      })

      if (!existingQuery || existingQuery.userId !== userId) {
        return addRateLimitHeaders(
          NextResponse.json({ success: false, error: 'Unauthorized to update this query' }, { status: 403 })
        )
      }

      const output_mode = outputModeMap[outputMode] || 1

      // Extract sorting preference from question
      const sortPreference = extractSortPreference(question)
      
      // Execute the query to get fresh results
      const queryResult = await executeSQLQuery(sql, question, sortPreference)
      if (!queryResult.success) {
        return addRateLimitHeaders(
          NextResponse.json({ success: false, error: queryResult.error }, { status: 400 })
        )
      }

      // Use frontend columns if provided (preserves reordering), otherwise use database columns
      const columnsToSave = columns && columns.length > 0 ? columns : queryResult.columns || []
      
      // Only transform if columns don't already have human-readable names
      const needsTransformation = columnsToSave.some((col: any) => 
        col.name && (col.name === col.key || col.name.includes('_') || col.name === col.name.toUpperCase())
      )
      const transformedColumns = needsTransformation ? transformColumnsToHumanReadable(columnsToSave) : columnsToSave
      
      const updatedQuery = await businessPrisma.savedQuery.update({
        where: { id: parseInt(id) },
        data: {
          title,
          queryText: question,
          comboPrompt: body.comboPrompt || question, // Store combo prompt if provided, otherwise use question
          sqlText: sql,
          outputMode: output_mode,
          visualConfig: visualConfig ? JSON.stringify(visualConfig) : null,
          resultData: JSON.stringify(queryResult.rows || []),
          resultColumns: JSON.stringify(transformedColumns),
          selectedColumns: selectedColumns ? JSON.stringify(selectedColumns) : null,
          filteredColumns: filteredColumns ? JSON.stringify(filteredColumns) : null,
          updatedAt: new Date(),
        },
      })

      return addRateLimitHeaders(
        NextResponse.json({ success: true, id: updatedQuery.id })
      )
    }

    // ---- 3. Delete Query Branch ----
    if (body.action === "delete") {
      const userId = getUserIdFromRequest(req)
      const { id } = body

      if (!id) {
        return addRateLimitHeaders(
          NextResponse.json({ success: false, error: 'Query ID is required' }, { status: 400 })
        )
      }

      // Verify the user owns this query
      const existingQuery = await businessPrisma.savedQuery.findUnique({
        where: { id: parseInt(id) },
        select: { userId: true }
      })

      if (!existingQuery || existingQuery.userId !== userId) {
        return addRateLimitHeaders(
          NextResponse.json({ success: false, error: 'Unauthorized to delete this query' }, { status: 403 })
        )
      }

      await businessPrisma.savedQuery.delete({
        where: { id: parseInt(id) }
      })

      return addRateLimitHeaders(
        NextResponse.json({ success: true })
      )
    }

    // ---- 4. Fetch Saved Results Branch ----
    if (body.action === "fetchSaved") {
      const userId = getUserIdFromRequest(req)
      const { id } = body

      if (!id) {
        return addRateLimitHeaders(
          NextResponse.json({ success: false, error: 'Query ID is required' }, { status: 400 })
        )
      }

      const savedQuery = await businessPrisma.savedQuery.findUnique({
        where: { id: parseInt(id) },
        select: {
          userId: true,
          resultData: true,
          resultColumns: true,
          sqlText: true,
          queryText: true,
          comboPrompt: true,
          outputMode: true,
          visualConfig: true,
          selectedColumns: true,
          filteredColumns: true,
        }
      })

      if (!savedQuery || savedQuery.userId !== userId) {
        return addRateLimitHeaders(
          NextResponse.json({ success: false, error: 'Saved query not found or unauthorized' }, { status: 404 })
        )
      }

      const data = savedQuery.resultData ? JSON.parse(savedQuery.resultData) : []
      const columns = savedQuery.resultColumns ? JSON.parse(savedQuery.resultColumns) : []
      
      // Only transform if columns don't already have human-readable names
      const needsTransformation = columns.some((col: any) => 
        col.name && (col.name === col.key || col.name.includes('_') || col.name === col.name.toUpperCase())
      )
      const transformedColumns = needsTransformation ? transformColumnsToHumanReadable(columns) : columns
      
      const outputMode = savedQuery.outputMode === 2 ? 'chart' : savedQuery.outputMode === 3 ? 'pie' : 'table'
      
      // Parse visual config if it exists
      const visualConfig = savedQuery.visualConfig ? JSON.parse(savedQuery.visualConfig) : null

      return addRateLimitHeaders(
        NextResponse.json({
          success: true,
          data,
          columns: transformedColumns,
          sql: savedQuery.sqlText,
          question: savedQuery.queryText,
          comboPrompt: savedQuery.comboPrompt || savedQuery.queryText || '', // Use comboPrompt if available, fallback to queryText, then empty string
          outputMode,
          visualConfig,
          selectedColumns: savedQuery.selectedColumns ? JSON.parse(savedQuery.selectedColumns) : null,
          filteredColumns: savedQuery.filteredColumns ? JSON.parse(savedQuery.filteredColumns) : null,
        })
      )
    }

    // ---- 5. Execute Query Branch (existing functionality) ----
    const { question, sql, outputMode, columns, dataSample } = body

    if (!question || !sql || !outputMode || !columns) {
      return addRateLimitHeaders(
        NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 })
      )
    }

    console.time("🔁 EXECUTE_SQL")
    // Extract sorting preference from question
    const sortPreference = extractSortPreference(question)
    const result = await executeSQLQuery(sql, question, sortPreference)
    console.timeEnd("🔁 EXECUTE_SQL")

    if (!result.success) {
      return addRateLimitHeaders(
        NextResponse.json({ success: false, error: result.error }, { status: 400 })
      )
    }

    console.timeEnd("🔁 TOTAL /api/query")
    
    // Transform column names to human-readable aliases
    const transformedColumns = transformColumnsToHumanReadable(result.columns || [])
    
    return addRateLimitHeaders(
      NextResponse.json({
        success: true,
        data: result.rows || [],
        columns: transformedColumns,
        sql: sql,
        question: question,
        outputMode: outputMode,
      })
    )

  } catch (error: any) {
    console.error('[QUERY_ERROR]', error)
    
    // Don't expose detailed errors in production
    const errorMessage = features.enableDetailedErrors 
      ? error.message || 'Unknown error'
      : 'An error occurred while processing your query'
    
    console.timeEnd("🔁 TOTAL /api/query")
    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json()
    const { id } = body

    if (!id) {
      return NextResponse.json({ success: false, error: 'Query ID is required' }, { status: 400 })
    }

    await businessPrisma.savedQuery.delete({
      where: { id: parseInt(id) }
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('[DELETE_QUERY_ERROR]', error)
    return NextResponse.json({ success: false, error: error.message || 'Failed to delete query' }, { status: 500 })
  }
}



