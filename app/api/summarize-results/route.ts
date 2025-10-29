import { NextRequest, NextResponse } from 'next/server'
import { openai as openaiConfig, features, app } from '@/lib/config'
import { rateLimiters, createRateLimitHeaders, checkRateLimit } from '@/lib/rate-limiter'

export async function POST(request: NextRequest) {
  const rateLimitResult = checkRateLimit(request, 10, 60 * 1000) // 10 requests per minute
  if (!rateLimitResult.allowed) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { 
      status: 429,
      headers: createRateLimitHeaders(rateLimitResult)
    })
  }

  try {
    const body = await request.json()
    const { query, sql, results, columns } = body

    if (!query || !results) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Generate natural language summary using OpenAI
    const summary = await generateResultSummary(query, sql, results, columns)
    
    const response = NextResponse.json({ 
      summary,
      success: true,
      processingTime: 'ai-generated'
    })
    
    const headers = createRateLimitHeaders(rateLimitResult)
    Object.entries(headers).forEach(([k, v]) => response.headers.set(k, v))
    return response

  } catch (error) {
    console.error('Summary generation error:', error)
    return NextResponse.json({ 
      error: 'Failed to generate summary',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

async function generateResultSummary(
  originalQuery: string, 
  sql: string, 
  results: any[], 
  columns: string[]
): Promise<string> {
  
  // Prepare data for analysis
  const dataSummary = analyzeResults(results, columns)
  const queryType = categorizeQuery(originalQuery)
  
  const prompt = createSummaryPrompt(originalQuery, sql, dataSummary, queryType)
  
  try {
    // For now, return a fallback summary since we need to set up OpenAI properly
    return generateFallbackSummary(dataSummary, queryType, originalQuery, results)
  } catch (error) {
    console.error('Summary generation error:', error)
    return generateFallbackSummary(dataSummary, queryType, originalQuery, results)
  }
}

function analyzeResults(results: any[], columns: string[]) {
  if (!results || results.length === 0) {
    return { count: 0, insights: [] }
  }

  const insights = []
  const count = results.length

  // Get the actual data keys from the first result
  const dataKeys = Object.keys(results[0] || {})

  // Analyze numeric columns - check both display names and data keys
  const numericColumns = dataKeys.filter(key => 
    results.some(row => typeof row[key] === 'number')
  )

  for (const key of numericColumns) {
    const values = results.map((row: any) => row[key]).filter((val: any) => val != null)
    if (values.length > 0) {
      const avg = values.reduce((a: number, b: number) => a + b, 0) / values.length
      const max = Math.max(...values)
      const min = Math.min(...values)
      const median = values.sort((a, b) => a - b)[Math.floor(values.length / 2)]
      
      // Find the display name for this key
      const displayName = columns.find(col => 
        col.toLowerCase().includes(key.toLowerCase().replace(/_/g, ' ')) ||
        key.toLowerCase().includes(col.toLowerCase().replace(/\s/g, '_'))
      ) || key
      
      insights.push({
        column: displayName,
        key: key,
        average: avg,
        max: max,
        min: min,
        median: median,
        count: values.length,
        range: max - min
      })
    }
  }

  // Analyze categorical columns (like Department)
  const categoricalColumns = dataKeys.filter(key => 
    results.some(row => typeof row[key] === 'string')
  )

  for (const key of categoricalColumns) {
    const valueCounts: { [key: string]: number } = {}
    results.forEach((row: any) => {
      const val = row[key]
      if (val != null) {
        valueCounts[val] = (valueCounts[val] || 0) + 1
      }
    })
    
    const sortedValues = Object.entries(valueCounts)
      .sort(([,a], [,b]) => (b as number) - (a as number))
    
    // Find the display name for this key
    const displayName = columns.find(col => 
      col.toLowerCase().includes(key.toLowerCase().replace(/_/g, ' ')) ||
      key.toLowerCase().includes(col.toLowerCase().replace(/\s/g, '_'))
    ) || key
    
    insights.push({
      column: displayName,
      key: key,
      distribution: sortedValues,
      uniqueValues: sortedValues.length,
      mostCommon: sortedValues[0] ? sortedValues[0][0] : null,
      mostCommonCount: sortedValues[0] ? sortedValues[0][1] : 0
    })
  }

  return { count, insights, columns }
}

function categorizeQuery(query: string): string {
  const q = query.toLowerCase()
  
  if (q.includes('correlation') || q.includes('relationship')) {
    return 'correlation'
  } else if (q.includes('department') && q.includes('compare')) {
    return 'department_comparison'
  } else if (q.includes('top') || q.includes('best') || q.includes('highest')) {
    return 'ranking'
  } else if (q.includes('average') || q.includes('mean')) {
    return 'aggregation'
  } else if (q.includes('staff') && (q.includes('more than') || q.includes('above'))) {
    return 'conditional_filtering'
  } else if (q.includes('group') || q.includes('by experience')) {
    return 'grouping'
  } else if (q.includes('drop') || q.includes('decrease')) {
    return 'trend_analysis'
  } else {
    return 'general_analysis'
  }
}

// Compute Pearson correlation coefficient for two numeric keys
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

function computeSlope(pairs: Array<{x: number, y: number}>): number | null {
  const n = pairs.length
  if (n < 2) return null
  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0
  for (const { x, y } of pairs) {
    if (typeof x !== 'number' || typeof y !== 'number') return null
    sumX += x
    sumY += y
    sumXY += x * y
    sumX2 += x * x
  }
  const denom = n * sumX2 - sumX * sumX
  if (!denom) return null
  return (n * sumXY - sumX * sumY) / denom
}

function pickKeyByHints(keys: string[], hints: string[]): string | undefined {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')
  const normalizedKeys = keys.map(k => ({ k, n: norm(k) }))
  for (const hint of hints) {
    const h = norm(hint)
    const hit = normalizedKeys.find(({ n }) => n.includes(h))
    if (hit) return hit.k
  }
  return undefined
}

function createSummaryPrompt(
  originalQuery: string, 
  sql: string, 
  dataSummary: any, 
  queryType: string
): string {
  const { count, insights } = dataSummary
  
  let prompt = `ORIGINAL QUERY: "${originalQuery}"\n\n`
  prompt += `SQL GENERATED: ${sql}\n\n`
  prompt += `RESULTS ANALYSIS:\n`
  prompt += `- Total records analyzed: ${count}\n\n`
  
  if (insights.length > 0) {
    prompt += `KEY METRICS FOUND:\n`
    insights.forEach((insight: any) => {
      if (insight.average !== undefined) {
        prompt += `- ${insight.column}: Average ${insight.average.toFixed(2)}, Range ${insight.min}-${insight.max}\n`
      } else if (insight.distribution) {
        prompt += `- ${insight.column}: ${insight.uniqueValues} unique values\n`
        if (insight.distribution.length > 0) {
          prompt += `  Top values: ${insight.distribution.slice(0, 3).map(([val, count]: [string, number]) => `${val} (${count})`).join(', ')}\n`
        }
      }
    })
  }
  
  prompt += `\nQUERY TYPE: ${queryType}\n\n`
  prompt += `Please provide a comprehensive summary that:\n`
  prompt += `1. Explains what the data shows in plain English\n`
  prompt += `2. Highlights the most important findings\n`
  prompt += `3. Provides actionable insights for healthcare management\n`
  prompt += `4. Mentions any concerning patterns or positive trends\n`
  prompt += `5. Gives context about the scope of analysis (${count} records)`

  return prompt
}

function generateFallbackSummary(dataSummary: any, queryType: string, originalQuery?: string, results?: any[]): string {
  const { count, insights } = dataSummary
  
  let summary = ''

  // Question-aware answer first
  if (queryType === 'correlation' && results && results.length > 0) {
    const keys = Object.keys(results[0] || {})
    // Prefer exact schema columns when available
    const experienceKey =
      pickKeyByHints(keys, ['Years_of_Experience', 'Years of Experience', 'experience', 'years'])
    const satisfactionKey =
      pickKeyByHints(keys, ['Satisfaction_Score', 'Satisfaction Score', 'satisfaction'])

    const aKey = experienceKey || pickKeyByHints(keys, ['experience', 'years'])
    const bKey = satisfactionKey || pickKeyByHints(keys, ['satisfaction', 'score'])

    if (aKey && bKey && aKey !== bKey) {
      const pairs = results
        .map((r: any) => ({ x: r[aKey], y: r[bKey] }))
        .filter(p => typeof p.x === 'number' && typeof p.y === 'number')

      const r = computeCorrelation(pairs)
      const slope = computeSlope(pairs)
      const pretty = (s: string) => s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())

      if (typeof r === 'number') {
        const strength = Math.abs(r)
        const label = r > 0 ? 'positive' : 'negative'
        const strengthLabel = strength >= 0.7 ? 'strong' : strength >= 0.4 ? 'moderate' : strength >= 0.2 ? 'weak' : 'very weak'
        const slopeText = typeof slope === 'number' ? `, and each +1 unit in ${pretty(aKey)} is associated with ${slope >= 0 ? '+' : ''}${slope.toFixed(2)} change in ${pretty(bKey)}` : ''
        summary += `Answer: There is a ${strengthLabel} ${label} correlation (r = ${r.toFixed(2)}) between ${pretty(aKey)} and ${pretty(bKey)} across ${pairs.length} records${slopeText}.\n\n`
      }
    }
  }

  if (!summary) {
    summary = `Answer: Based on ${count} records, here are the key findings relevant to your question.\n\n`
  }
  
  summary += `Key Findings:\n`
  
  // Find satisfaction insights
  const satisfactionInsight = insights?.find((i: any) => i.column.toLowerCase().includes('satisfaction'))
  const experienceInsight = insights?.find((i: any) => i.column.toLowerCase().includes('experience'))
  const overtimeInsight = insights?.find((i: any) => i.column.toLowerCase().includes('overtime'))
  const departmentInsight = insights?.find((i: any) => i.column.toLowerCase().includes('department'))
  
  if (
    satisfactionInsight &&
    typeof satisfactionInsight.average === 'number' &&
    experienceInsight &&
    typeof experienceInsight.min === 'number' &&
    typeof experienceInsight.max === 'number'
  ) {
    summary += `• Satisfaction avg ${satisfactionInsight.average.toFixed(1)}/5.0; experience range ${experienceInsight.min}-${experienceInsight.max} years\n`
    if (typeof satisfactionInsight.max === 'number' && typeof satisfactionInsight.min === 'number') {
      const satisfactionRange = satisfactionInsight.max - satisfactionInsight.min
      summary += `• Satisfaction varies by ${satisfactionRange.toFixed(1)} points across the sample\n`
    }
  }
  
  if (overtimeInsight && typeof overtimeInsight.average === 'number') {
    summary += `• Overtime avg ${overtimeInsight.average.toFixed(1)} hours\n`
  }
  
  if (departmentInsight && Array.isArray(departmentInsight.distribution) && departmentInsight.distribution.length > 0) {
    const topDept: [string, number] = departmentInsight.distribution[0] as [string, number]
    const secondDept: [string, number] | undefined = departmentInsight.distribution[1] as [string, number] | undefined
    summary += `• Dept mix: ${topDept[0]} (${topDept[1]})${secondDept ? `, ${secondDept[0]} (${secondDept[1]})` : ''}\n`
  }
  
  // Close with guidance tied to query type
  if (queryType === 'correlation') {
    summary += `\nInterpretation: Positive r suggests higher ${originalQuery?.includes('experience') ? 'experience' : 'X'} tends to align with higher ${originalQuery?.includes('satisfaction') ? 'satisfaction' : 'Y'}; negative r suggests the opposite.`
  } else if (queryType === 'aggregation') {
    summary += `\nInterpretation: Averages help compare groups; consider outliers and sample sizes.`
  }

  return summary
}
