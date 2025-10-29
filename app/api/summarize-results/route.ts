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
      const median = values.sort((a, b) => a - b)[Math.floor(values.length / 2)]
      
      insights.push({
        column: col,
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
    
    // Find satisfaction insights
    const satisfactionInsight = insights.find((i: any) => i.column.toLowerCase().includes('satisfaction'))
    const experienceInsight = insights.find((i: any) => i.column.toLowerCase().includes('experience'))
    const overtimeInsight = insights.find((i: any) => i.column.toLowerCase().includes('overtime'))
    const departmentInsight = insights.find((i: any) => i.column.toLowerCase().includes('department'))
    
    if (satisfactionInsight && experienceInsight) {
      summary += `• Satisfaction vs Experience: Average satisfaction is ${satisfactionInsight.average.toFixed(1)}/5.0, with experience ranging from ${experienceInsight.min} to ${experienceInsight.max} years\n`
      
      // Add correlation insights
      if (satisfactionInsight.average > 4.0) {
        summary += `• High Performance: Staff show strong satisfaction levels (${satisfactionInsight.average.toFixed(1)}/5.0), indicating good workplace conditions\n`
      } else if (satisfactionInsight.average < 3.0) {
        summary += `• Attention Needed: Satisfaction levels are concerning (${satisfactionInsight.average.toFixed(1)}/5.0), suggesting areas for improvement\n`
      }
    }
    
    if (overtimeInsight) {
      if (overtimeInsight.average > 10) {
        summary += `• High Overtime: Staff average ${overtimeInsight.average.toFixed(1)} overtime hours, indicating potential workload issues\n`
      } else if (overtimeInsight.average < 5) {
        summary += `• Balanced Workload: Overtime levels are reasonable at ${overtimeInsight.average.toFixed(1)} hours average\n`
      }
    }
    
    if (departmentInsight && departmentInsight.distribution) {
      const topDept = departmentInsight.distribution[0]
      const secondDept = departmentInsight.distribution[1]
      summary += `• Department Distribution: ${topDept[0]} leads with ${topDept[1]} staff`
      if (secondDept) {
        summary += `, followed by ${secondDept[0]} with ${secondDept[1]} staff`
      }
      summary += `\n`
    }
    
    // Add specific insights based on query type
    if (queryType === 'correlation') {
      summary += `\nCorrelation Analysis: This data shows the relationship between different staff metrics. Look for patterns in how variables change together.\n`
    } else if (queryType === 'ranking') {
      summary += `\nTop Performers: These results highlight the highest-performing staff members based on your criteria.\n`
    } else if (queryType === 'aggregation') {
      summary += `\nDepartmental Overview: This analysis provides insights into how different departments compare across key metrics.\n`
    }
  }
  
  summary += `\nThis analysis provides valuable insights into healthcare workforce patterns and can help inform management decisions.`
  
  return summary
}
