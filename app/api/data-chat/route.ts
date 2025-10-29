import { NextRequest, NextResponse } from 'next/server'
import { openai as openaiConfig } from '@/lib/config'

// --- Simple helpers ---
function computeCorrelation(pairs: Array<{x: number, y: number}>): number | null {
  const n = pairs.length
  if (n < 2) return null
  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0, sumY2 = 0
  for (const { x, y } of pairs) {
    if (typeof x !== 'number' || typeof y !== 'number') return null
    sumX += x
    sumY += y
    sumXY += x * y
    sumX2 += x * x
    sumY2 += y * y
  }
  const numerator = n * sumXY - sumX * sumY
  const denom = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY))
  if (!denom || !isFinite(denom)) return null
  return numerator / denom
}

function pretty(key: string): string { return key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) }

// Very light retrieval: keyword overlap scoring
function buildEvidencePack(question: string, results: any[], columns: string[], k = 20) {
  const q = question.toLowerCase()
  const qTokens = q.split(/[^a-z0-9]+/).filter(Boolean)

  const scored = results.map((row, idx) => {
    const text = columns.map((c, i) => String(row[Object.keys(row)[i]] ?? '')).join(' | ').toLowerCase()
    const tokens = new Set(text.split(/[^a-z0-9]+/).filter(Boolean))
    let score = 0
    for (const t of qTokens) if (tokens.has(t)) score += 1
    return { idx, score, row }
  }).sort((a,b) => b.score - a.score)

  const top = scored.slice(0, k)

  // basic stats for numerics
  const keys = Object.keys(results[0] || {})
  const numeric = keys.filter(k2 => results.some(r => typeof r[k2] === 'number'))
  const stats = numeric.map(k2 => {
    const vals = results.map(r => r[k2]).filter((v:any)=> typeof v === 'number')
    if (!vals.length) return null
    const avg = vals.reduce((a:number,b:number)=>a+b,0)/vals.length
    const min = Math.min(...vals)
    const max = Math.max(...vals)
    return { column: k2, average: avg, min, max, count: vals.length }
  }).filter(Boolean)

  return {
    schema: keys.map(k2 => ({ key: k2, label: pretty(k2) })),
    stats,
    rows: top.map(t => ({ id: t.idx, data: t.row }))
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { history = [], context = {} } = body
    const { question = '', results = [], columns = [], sql = '' } = context

    const userMessage = history[history.length - 1]?.content || question || ''
    const evidence = buildEvidencePack(userMessage, results || [], columns || [])

    const system = `You are a strict RAG data analyst. Answer ONLY using the provided EVIDENCE. 
- If the evidence is insufficient, say you cannot answer from the current results and suggest a follow-up query.
- Be concise, numeric, and cite row ids like [#12,#27] when referencing examples.
- Never invent data not present in evidence.`

    const evidenceText = `SQL: ${sql || '(not provided)'}\nColumns: ${columns.join(', ')}\n\nStats:\n${evidence.stats.map(s=>`- ${pretty(s!.column)}: avg ${s!.average.toFixed(2)} (min ${s!.min}, max ${s!.max}, n=${s!.count})`).join('\n') || '(none)'}\n\nRows (top-k relevant):\n${evidence.rows.map(r=>`#${r.id}: ${JSON.stringify(r.data)}`).join('\n') || '(none)'}\n`

    // If model configured, ask it; otherwise do a small rule-based fallback
    let answer: string | null = null
    try {
      if (openaiConfig.apiKey) {
        const completion = await openaiConfig.client.responses.create({
          model: openaiConfig.model,
          max_output_tokens: 350,
          input: [
            { role: 'system', content: system },
            { role: 'user', content: `QUESTION:\n${userMessage}\n\nEVIDENCE:\n${evidenceText}\n\nAnswer strictly grounded in the evidence. Include short numeric justification and cite row ids when applicable.` }
          ]
        } as any)
        // Compatible extraction across client variants
        // @ts-ignore
        answer = completion?.output_text || completion?.choices?.[0]?.message?.content || null
      }
    } catch (err) {
      // fall through to heuristic
      answer = null
    }

    if (!answer) {
      // Heuristic fallback: correlation if both keys exist
      const keys = Object.keys(results?.[0] || {})
      const expKey = keys.find(k => k.toLowerCase().includes('experience'))
      const satKey = keys.find(k => k.toLowerCase().includes('satisfaction'))
      if (expKey && satKey) {
        const pairs = (results||[]).map((r:any)=> ({ x: r[expKey], y: r[satKey] }))
          .filter(p => typeof p.x === 'number' && typeof p.y === 'number')
        const r = computeCorrelation(pairs)
        if (typeof r === 'number') {
          const label = r>0 ? 'positive' : 'negative'
          answer = `From current results (n=${pairs.length}), correlation between ${pretty(expKey)} and ${pretty(satKey)} is r=${r.toFixed(2)} (${label}).`
        }
      }
      if (!answer) {
        answer = `From the provided evidence (${results?.length || 0} rows), I cannot conclusively answer. Try refining the question or regenerate results with more relevant columns.`
      }
    }

    return NextResponse.json({ success: true, answer, evidence })
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || 'Chat failed' }, { status: 500 })
  }
}
