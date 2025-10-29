import { NextRequest, NextResponse } from 'next/server'

// Simple helper reused from summarize route (duplicated to keep file isolated)
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

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { history = [], context = {} } = body
    const { question = '', results = [], columns = [], sql = '' } = context

    const userMessage = history[history.length - 1]?.content || question || ''
    const response = answerWithContext(userMessage, results, columns)

    return NextResponse.json({ success: true, answer: response })
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || 'Chat failed' }, { status: 500 })
  }
}

function answerWithContext(message: string, results: any[], columns: string[]): string {
  const msg = message.toLowerCase()
  const keys = Object.keys(results?.[0] || {})
  const findKey = (hint: string) => keys.find(k => k.toLowerCase().includes(hint))

  // Correlation style Q&A
  if (msg.includes('correlation') || msg.includes('relationship')) {
    const aKey = findKey('experience') || findKey('years')
    const bKey = findKey('satisfaction') || findKey('score')
    if (aKey && bKey) {
      const pairs = results
        .map(r => ({ x: r[aKey], y: r[bKey] }))
        .filter(p => typeof p.x === 'number' && typeof p.y === 'number')
      const r = computeCorrelation(pairs)
      if (typeof r === 'number') {
        const strength = Math.abs(r)
        const label = r > 0 ? 'positive' : 'negative'
        const strengthLabel = strength >= 0.7 ? 'strong' : strength >= 0.4 ? 'moderate' : strength >= 0.2 ? 'weak' : 'very weak'
        return `There is a ${strengthLabel} ${label} correlation (r = ${r.toFixed(2)}) between ${pretty(aKey)} and ${pretty(bKey)} over ${pairs.length} records.`
      }
    }
  }

  // Aggregations
  if (msg.includes('average') || msg.includes('mean')) {
    const numKey = keys.find(k => typeof results?.[0]?.[k] === 'number')
    if (numKey) {
      const values = results.map(r => r[numKey]).filter((v: any) => typeof v === 'number')
      const avg = values.reduce((a: number, b: number) => a + b, 0) / (values.length || 1)
      return `Average ${pretty(numKey)} is ${avg.toFixed(2)} across ${values.length} records.`
    }
  }

  // Default: brief profile of the data to help follow-up
  const sample = results.slice(0, 3)
  return `I analyzed ${results.length} rows with columns ${columns.join(', ')}. Ask about correlation, averages, department comparisons, or thresholds (e.g., "staff with overtime > 10 and satisfaction < 3"). Sample: ${JSON.stringify(sample)}`
}

function pretty(key: string): string {
  return key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}
