import { NextRequest, NextResponse } from 'next/server'
import { businessPrisma } from '@/lib/mysql-prisma'
import { executeSQLQuery } from '@/lib/sql-query'
import { features } from '@/lib/config'
import { rateLimiters, createRateLimitHeaders, checkRateLimit } from '@/lib/rate-limiter'

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
      const {
        question,
        sql,
        outputMode,
        columns,
        dataSample,
        userId = 1,
        companyId = 1,
        visualConfig = null,
        panelPosition = null,
      } = body

      if (!question || !sql || !outputMode || !columns) {
        return addRateLimitHeaders(
          NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 })
        )
      }

      const output_mode = outputModeMap[outputMode] || 1

      // Execute the query to get fresh results
      const queryResult = await executeSQLQuery(sql, question)
      if (!queryResult.success) {
        return addRateLimitHeaders(
          NextResponse.json({ success: false, error: queryResult.error }, { status: 400 })
        )
      }

      const savedQuery = await businessPrisma.savedQuery.create({
        data: {
          userId,
          companyId,
          title: question,
          queryText: question,
          sqlText: sql,
          outputMode: output_mode,
          visualConfig: visualConfig ? JSON.stringify(visualConfig) : null,
          panelPosition,
          resultData: JSON.stringify(queryResult.rows || []),
          resultColumns: JSON.stringify(queryResult.columns || []),
        },
      })

      return addRateLimitHeaders(
        NextResponse.json({ success: true, id: savedQuery.id })
      )
    }

    // ---- 2. Update Query Branch ----
    if (body.action === "update") {
      const { id, title, question, sql, outputMode, columns, visualConfig } = body

      if (!id || !title || !question || !sql || !outputMode || !columns) {
        return addRateLimitHeaders(
          NextResponse.json({ success: false, error: 'Missing required fields for update' }, { status: 400 })
        )
      }

      const output_mode = outputModeMap[outputMode] || 1

      // Execute the query to get fresh results
      const queryResult = await executeSQLQuery(sql, question)
      if (!queryResult.success) {
        return addRateLimitHeaders(
          NextResponse.json({ success: false, error: queryResult.error }, { status: 400 })
        )
      }

      const updatedQuery = await businessPrisma.savedQuery.update({
        where: { id: parseInt(id) },
        data: {
          title,
          queryText: question,
          sqlText: sql,
          outputMode: output_mode,
          visualConfig: visualConfig ? JSON.stringify(visualConfig) : null,
          resultData: JSON.stringify(queryResult.rows || []),
          resultColumns: JSON.stringify(queryResult.columns || []),
          updatedAt: new Date(),
        },
      })

      return addRateLimitHeaders(
        NextResponse.json({ success: true, id: updatedQuery.id })
      )
    }

    // ---- 3. Fetch Saved Results Branch ----
    if (body.action === "fetchSaved") {
      const { id } = body

      if (!id) {
        return addRateLimitHeaders(
          NextResponse.json({ success: false, error: 'Query ID is required' }, { status: 400 })
        )
      }

      const savedQuery = await businessPrisma.savedQuery.findUnique({
        where: { id: parseInt(id) },
        select: {
          resultData: true,
          resultColumns: true,
          sqlText: true,
          queryText: true,
          outputMode: true,
          visualConfig: true,
        }
      })

      if (!savedQuery) {
        return addRateLimitHeaders(
          NextResponse.json({ success: false, error: 'Saved query not found' }, { status: 404 })
        )
      }

      const data = savedQuery.resultData ? JSON.parse(savedQuery.resultData) : []
      const columns = savedQuery.resultColumns ? JSON.parse(savedQuery.resultColumns) : []
      
      const outputMode = savedQuery.outputMode === 2 ? 'chart' : savedQuery.outputMode === 3 ? 'pie' : 'table'
      
      // Parse visual config if it exists
      const visualConfig = savedQuery.visualConfig ? JSON.parse(savedQuery.visualConfig) : null

      return addRateLimitHeaders(
        NextResponse.json({
          success: true,
          data,
          columns,
          sql: savedQuery.sqlText,
          question: savedQuery.queryText,
          outputMode,
          visualConfig,
        })
      )
    }

    // ---- 4. Execute Query Branch (existing functionality) ----
    const { question, sql, outputMode, columns, dataSample } = body

    if (!question || !sql || !outputMode || !columns) {
      return addRateLimitHeaders(
        NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 })
      )
    }

    console.time("🔁 EXECUTE_SQL")
    const result = await executeSQLQuery(sql, question)
    console.timeEnd("🔁 EXECUTE_SQL")

    if (!result.success) {
      return addRateLimitHeaders(
        NextResponse.json({ success: false, error: result.error }, { status: 400 })
      )
    }

    console.timeEnd("🔁 TOTAL /api/query")
    return addRateLimitHeaders(
      NextResponse.json({
        success: true,
        data: result.rows || [],
        columns: result.columns || [],
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



