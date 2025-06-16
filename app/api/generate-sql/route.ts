// File: app/api/generate-sql/route.ts
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
  try {
    const { default: OpenAI } = await import('openai')
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

    const { question } = await req.json()
    if (!question) {
      return NextResponse.json({ error: 'Missing question input' }, { status: 400 })
    }

    // 1. Load schema from DB
    const connection = await mysql.createConnection(dbConfig)
    const [rows] = await connection.execute('SELECT schema_text FROM schema_definitions2 WHERE id = 1')
    await connection.end()

    const schemaText = (rows[0] as any)?.schema_text || ''

    // 2. Construct full prompt
//     const baseInstruction = `
// You are an assistant that converts natural language questions into MySQL SELECT statements.
// Only use SELECT queries — do not modify the database.
// Always alias columns with AS '...'.
// You may only reference fields listed in the schema.
// Do not use SELECT *.
// Respond ONLY with valid MySQL SELECT code — no explanation.
//     `

    const baseInstruction = `
    You are an assistant that converts natural language questions into MySQL SELECT statements.
    Only use SELECT queries — do not modify the database.
    Always alias columns with AS '...'.
    You may only reference fields listed in the schema.
    Do not use SELECT *.
    Unless the user specifically asks for a gift ID, do not include columns named "id" or alias them as "Gift ID".
    Respond ONLY with valid MySQL SELECT code — no explanation.

    When the user asks for the "top N" of something, ensure that only the LIMIT changes if the number N changes, and the logic of the SQL (grouping, aggregation, ordering, etc.) remains otherwise consistent for similar requests.

    If the user specifies "by [field]" (such as "by designation"), group results by that field, order by a relevant aggregate (such as SUM or COUNT), and apply the LIMIT.
    If the user simply says "top N" without "by [field]", return the N largest individual rows according to context.
    `;

    
    const fullSystemPrompt = `${schemaText}\n\n${baseInstruction}`

    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        { role: 'system', content: fullSystemPrompt },
        { role: 'user', content: question },
      ],
      temperature: 0,
    })

    const sql = completion.choices[0].message.content?.trim() || ''
    return NextResponse.json({ sql })
  } catch (error: any) {
    console.error('[SQL_GEN_ERROR]', error)
    return NextResponse.json({ error: error.message || 'Unknown error' }, { status: 500 })
  }
}
