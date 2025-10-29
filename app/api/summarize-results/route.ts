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
    return generateFallbackSummary(dataSummary, queryType)
  } catch (error) {
    console.error('Summary generation error:', error)
    return generateFallbackSummary(dataSummary, queryType)
  }
}

function analyzeResults(results: any[], columns: string[]) {
  if (!results || results.length === 0) {
    return { count: 0, insights: [] }
  }

  const insights = []
  const count = results.length

  // Analyze numeric columns
  const numericColumns = columns.filter(col => 
    results.some(row => typeof row[col] === 'number')
  )

  for (const col of numericColumns) {
    const values = results.map((row: any) => row[col]).filter((val: any) => val != null)
    if (values.length > 0) {
      const avg = values.reduce((a: number, b: number) => a + b, 0) / values.length
      const max = Math.max(...values)
      const min = Math.min(...values)
      
      insights.push({
        column: col,
        average: avg,
        max: max,
        min: min,
        count: values.length
      })
    }
  }

  // Analyze categorical columns (like Department)
  const categoricalColumns = columns.filter(col => 
    results.some(row => typeof row[col] === 'string')
  )

  for (const col of categoricalColumns) {
    const valueCounts: { [key: string]: number } = {}
    results.forEach((row: any) => {
      const val = row[col]
      if (val != null) {
        valueCounts[val] = (valueCounts[val] || 0) + 1
      }
    })
    
    const sortedValues = Object.entries(valueCounts)
      .sort(([,a], [,b]) => (b as number) - (a as number))
    
    insights.push({
      column: col,
      distribution: sortedValues,
      uniqueValues: sortedValues.length
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
    insights.forEach(insight => {
      if (insight.average !== undefined) {
        prompt += `- ${insight.column}: Average ${insight.average.toFixed(2)}, Range ${insight.min}-${insight.max}\n`
      } else if (insight.distribution) {
        prompt += `- ${insight.column}: ${insight.uniqueValues} unique values\n`
        if (insight.distribution.length > 0) {
          prompt += `  Top values: ${insight.distribution.slice(0, 3).map(([val, count]) => `${val} (${count})`).join(', ')}\n`
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

function generateFallbackSummary(dataSummary: any, queryType: string): string {
  const { count, insights } = dataSummary
  
  let summary = `Analysis of ${count} healthcare staff records reveals the following insights:\n\n`
  
  if (insights.length > 0) {
    summary += `Key Findings:\n`
    insights.forEach((insight: any) => {
      if (insight.average !== undefined) {
        summary += `• ${insight.column}: Average of ${insight.average.toFixed(2)} (range: ${insight.min}-${insight.max})\n`
      } else if (insight.distribution && insight.distribution.length > 0) {
        summary += `• ${insight.column}: ${insight.uniqueValues} different categories\n`
        if (insight.distribution.length > 0) {
          summary += `  Top values: ${insight.distribution.slice(0, 3).map(([val, count]: [string, number]) => `${val} (${count})`).join(', ')}\n`
        }
      }
    })
  }
  
  summary += `\nThis analysis provides valuable insights into healthcare workforce patterns and can help inform management decisions.`
  
  return summary
}
