// File: app/api/generate-sql/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { authPrisma } from '@/lib/auth-prisma'

export async function POST(req: NextRequest) {
  try {
    const { default: OpenAI } = await import('openai')
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

    const { question } = await req.json()
    if (!question) {
      return NextResponse.json({ error: 'Missing question input' }, { status: 400 })
    }

    // 1. Load schema from DB - get the first schema definition (we only have one)
    const schemaDefinition = await authPrisma.schemaDefinition.findFirst({
      select: { schemaText: true }
    })

    const schemaText = schemaDefinition?.schemaText || ''

    // 2. Construct full prompt for SQL generation
    const baseInstruction = `
    You are an assistant that converts natural language questions into SQL queries for a MySQL database.
    Only use SELECT queries — do not modify the database.
    Always use proper field names and table aliases.
    You may only reference fields listed in the schema.
    Respond ONLY with valid SQL query code — no explanation.

    Database Schema:
    - gifts table: id, ACCOUNTID, GIFTID, GIFTDATE, GIFTAMOUNT, TRANSACTIONTYPE, GIFTTYPE, PAYMENTMETHOD, PLEDGEID, SOFTCREDITINDICATOR, SOFTCREDITAMOUNT, SOFTCREDITID, SOURCECODE, DESIGNATION, UNIT, PURPOSECATEGORY, APPEAL, GIVINGLEVEL, UUID

    Common patterns:
    - For "top donors": SELECT ACCOUNTID, SUM(CAST(GIFTAMOUNT AS DECIMAL(15,2))) as totalAmount FROM gifts GROUP BY ACCOUNTID ORDER BY totalAmount DESC LIMIT N
    - For "gifts by source": SELECT SOURCECODE, COUNT(*) as giftCount, SUM(CAST(GIFTAMOUNT AS DECIMAL(15,2))) as totalAmount FROM gifts GROUP BY SOURCECODE ORDER BY totalAmount DESC
    - For "gifts by designation": SELECT DESIGNATION, COUNT(*) as giftCount, SUM(CAST(GIFTAMOUNT AS DECIMAL(15,2))) as totalAmount FROM gifts GROUP BY DESIGNATION ORDER BY totalAmount DESC
    - For "payment methods": SELECT PAYMENTMETHOD, COUNT(*) as giftCount, SUM(CAST(GIFTAMOUNT AS DECIMAL(15,2))) as totalAmount FROM gifts GROUP BY PAYMENTMETHOD ORDER BY totalAmount DESC

    Always use CAST(GIFTAMOUNT AS DECIMAL(15,2)) for amount calculations.
    Use GROUP BY for aggregations.
    Use ORDER BY for sorting.
    Use LIMIT for limiting results.
    All column names are in UPPERCASE.
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

    const sqlQuery = completion.choices[0].message.content?.trim() || ''
    return NextResponse.json({ sql: sqlQuery })
  } catch (error: any) {
    console.error('[SQL_GEN_ERROR]', error)
    return NextResponse.json({ error: error.message || 'Unknown error' }, { status: 500 })
  }
}
