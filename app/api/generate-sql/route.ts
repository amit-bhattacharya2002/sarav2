// File: app/api/generate-sql/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest) {
  try {
    const { default: OpenAI } = await import('openai')
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

    const { question } = await req.json()
    if (!question) {
      return NextResponse.json({ error: 'Missing question input' }, { status: 400 })
    }

    // 1. Load schema from DB - get the first schema definition (we only have one)
    const schemaDefinition = await prisma.schemaDefinition.findFirst({
      select: { schemaText: true }
    })

    const schemaText = schemaDefinition?.schemaText || ''

    // 2. Construct full prompt
    const baseInstruction = `
    You are an assistant that converts natural language questions into MongoDB aggregation pipeline queries.
    Only use aggregation queries — do not modify the database.
    Always use proper field names and aliases.
    You may only reference fields listed in the schema.
    Do not use $match with empty objects.
    Respond ONLY with valid MongoDB aggregation pipeline code — no explanation.

    When the user asks for the "top N" of something, ensure that only the $limit changes if the number N changes, and the logic of the aggregation (grouping, aggregation, ordering, etc.) remains otherwise consistent for similar requests.

    If the user specifies "by [field]" (such as "by designation"), group results by that field, order by a relevant aggregate (such as $sum or $count), and apply the $limit.
    If the user simply says "top N" without "by [field]", return the N largest individual documents according to context.
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

    const aggregationPipeline = completion.choices[0].message.content?.trim() || ''
    return NextResponse.json({ sql: aggregationPipeline })
  } catch (error: any) {
    console.error('[SQL_GEN_ERROR]', error)
    return NextResponse.json({ error: error.message || 'Unknown error' }, { status: 500 })
  }
}
