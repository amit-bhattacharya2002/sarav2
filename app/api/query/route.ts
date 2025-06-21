import { NextRequest, NextResponse } from 'next/server'
import mysql from 'mysql2/promise'

const dbConfig = {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: 3306,
}

// Maps string output modes to int (adjust as needed)
const outputModeMap: Record<string, number> = {
  table: 1,
  chart: 2,
  pie: 3,
}

export async function POST(req: NextRequest) {
  try {
    const {
      question,
      sql,
      outputMode,
      columns,
      dataSample,
      userId = null, // Optional
      companyId = null, // Optional
      visualConfig = null, // For future
      panelPosition = null // For future
    } = await req.json()

    if (!question || !sql || !outputMode || !columns) {
      return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 })
    }

    const output_mode = outputModeMap[outputMode] || 1

    const connection = await mysql.createConnection(dbConfig)
    const [result] = await connection.execute(
      `INSERT INTO saved_queries
        (user_id, company_id, query_text, sql_text, output_mode, created_at, visual_config, panel_position)
      VALUES (?, ?, ?, ?, ?, NOW(), ?, ?)`,
      [
        userId,
        companyId,
        question,
        sql,
        output_mode,
        visualConfig ? JSON.stringify(visualConfig) : null,
        panelPosition
      ]
    )

    // Optionally, store columns/dataSample in a separate table or as JSON in visual_config if desired.

    await connection.end()
    return NextResponse.json({ success: true, id: (result as any).insertId })
  } catch (error: any) {
    console.error('[SAVE_QUERY_ERROR]', error)
    return NextResponse.json({ success: false, error: error.message || 'Save query error' }, { status: 500 })
  }
}
