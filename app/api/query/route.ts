import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { executeQuery } from '@/lib/mongodb-query'

// Map outputMode string to int for DB (customize as needed)
const outputModeMap: Record<string, number> = {
  table: 1,
  chart: 2,
  pie: 3,
}

export async function POST(req: NextRequest) {
  console.time("🔁 TOTAL /api/query")
  try {
    const body = await req.json()

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
        return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 })
      }

      const output_mode = outputModeMap[outputMode] || 1

      const savedQuery = await prisma.savedQuery.create({
        data: {
          userId,
          companyId,
          title: question,
          queryText: question,
          sqlText: sql,
          outputMode: output_mode,
          visualConfig: visualConfig ? JSON.stringify(visualConfig) : null,
          panelPosition,
        },
      })

      return NextResponse.json({ success: true, id: savedQuery.id })
    }

    // ---- 2. Run Query Branch (default) ----
    const { sql, question } = body
    console.log("🚨 Executing MongoDB aggregation:", sql)

    if (!sql || typeof sql !== 'string') {
      return NextResponse.json({ success: false, error: 'Missing or invalid aggregation pipeline' }, { status: 400 })
    }

    // Execute MongoDB aggregation pipeline
    const result = await executeQuery(question || '', sql)
    
    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 })
    }

    console.timeEnd("🔁 TOTAL /api/query")
    return NextResponse.json({ 
      success: true, 
      rows: result.rows || [], 
      columns: result.columns || [] 
    })

  } catch (error: any) {
    console.error('[QUERY_ERROR]', error)
    console.timeEnd("🔁 TOTAL /api/query")
    return NextResponse.json({ success: false, error: error.message || 'Query error' }, { status: 500 })
  }
}



