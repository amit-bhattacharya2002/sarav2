// File: app/api/saved-queries/route.ts
import { NextRequest, NextResponse } from 'next/server'
import mysql from 'mysql2/promise'

const dbConfig = {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: 3306,
}

export async function GET(req: NextRequest) {
  try {
    const userId = 1
    const companyId = 1

    const connection = await mysql.createConnection(dbConfig)
    const [rows] = await connection.execute(
      `SELECT id, title, sql_text, output_mode FROM saved_queries WHERE user_id = ? AND company_id = ? ORDER BY created_at DESC`,
      [userId, companyId]
    )
    await connection.end()

    return NextResponse.json({ queries: rows })
  } catch (error: any) {
    console.error('[LOAD_SAVED_QUERIES_ERROR]', error)
    return NextResponse.json({ error: 'Failed to load saved queries.' }, { status: 500 })
  }
}
