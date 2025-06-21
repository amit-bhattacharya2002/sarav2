import { NextRequest, NextResponse } from 'next/server'
import mysql from 'mysql2/promise'

const dbConfig = {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: 3306,
}




export async function POST(req: NextRequest) {
  console.time("🔁 TOTAL /api/query")

  try {
    const { sql } = await req.json()
    console.log("🚨 Executing SQL:", sql)  // <-- Add here

    if (!sql || typeof sql !== 'string') {
      return NextResponse.json({ success: false, error: 'Missing or invalid SQL string' }, { status: 400 })
    }

    console.time("⏳ DB CONNECT")
    const connection = await mysql.createConnection(dbConfig)
    console.timeEnd("⏳ DB CONNECT")

    console.time("🕒 SQL EXECUTE")
    const [rows, fields] = await connection.execute(sql)
    console.timeEnd("🕒 SQL EXECUTE")

    console.time("🔒 DB CLOSE")
    await connection.end()
    console.timeEnd("🔒 DB CLOSE")

    console.time("📦 FORMAT COLUMNS")
    const columns = fields.map((field: any) => ({
      key: field.name,
      name: field.name,
    }))
    console.timeEnd("📦 FORMAT COLUMNS")

    console.timeEnd("🔁 TOTAL /api/query")
    return NextResponse.json({ success: true, rows, columns })

  } catch (error: any) {
    console.error('[QUERY_ERROR]', error)
    console.timeEnd("🔁 TOTAL /api/query")
    return NextResponse.json({ success: false, error: error.message || 'Query error' }, { status: 500 })
  }
}
