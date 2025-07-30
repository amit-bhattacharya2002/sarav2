import { prisma } from './prisma'

export interface QueryResult {
  success: boolean
  rows?: any[]
  columns?: { key: string; name: string }[]
  error?: string
}

export async function executeMongoAggregation(pipeline: string): Promise<QueryResult> {
  try {
    // Parse the aggregation pipeline
    let aggregationPipeline: any[]
    try {
      aggregationPipeline = JSON.parse(pipeline)
    } catch (e) {
      return {
        success: false,
        error: 'Invalid aggregation pipeline format'
      }
    }

    // Execute the aggregation pipeline using Prisma's $runCommandRaw
    const result = await prisma.$runCommandRaw({
      aggregate: 'gifts', // Default collection
      pipeline: aggregationPipeline,
      cursor: {}
    })

    // Process the results
    const documents = (result as any).cursor?.firstBatch || []
    
    if (documents.length === 0) {
      return {
        success: true,
        rows: [],
        columns: []
      }
    }

    // Extract column names from the first document
    const firstDoc = documents[0]
    const columns = Object.keys(firstDoc).map(key => ({
      key,
      name: key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())
    }))

    return {
      success: true,
      rows: documents,
      columns
    }

  } catch (error) {
    console.error('MongoDB aggregation error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

// Helper function to determine the correct collection based on the query
export function getCollectionFromQuery(query: string): string {
  const lowerQuery = query.toLowerCase()
  
  if (lowerQuery.includes('constituent') || lowerQuery.includes('donor')) {
    return 'constituents'
  } else if (lowerQuery.includes('address')) {
    return 'addresses'
  } else {
    return 'gifts' // Default to gifts collection
  }
}

// Enhanced execution function that determines the collection
export async function executeQuery(query: string, pipeline: string): Promise<QueryResult> {
  try {
    const collection = getCollectionFromQuery(query)
    
    // Parse the aggregation pipeline
    let aggregationPipeline: any[]
    try {
      aggregationPipeline = JSON.parse(pipeline)
    } catch (e) {
      return {
        success: false,
        error: 'Invalid aggregation pipeline format'
      }
    }

    // Clean up the pipeline to handle common issues
    aggregationPipeline = aggregationPipeline.map(stage => {
      // Convert ISODate strings to proper date objects
      if (stage.$match && stage.$match.giftDate) {
        if (stage.$match.giftDate.$gte && typeof stage.$match.giftDate.$gte === 'string') {
          stage.$match.giftDate.$gte = new Date(stage.$match.giftDate.$gte)
        }
        if (stage.$match.giftDate.$lt && typeof stage.$match.giftDate.$lt === 'string') {
          stage.$match.giftDate.$lt = new Date(stage.$match.giftDate.$lt)
        }
      }
      
      // Handle $toDouble conversion for string amounts
      if (stage.$group) {
        Object.keys(stage.$group).forEach(key => {
          if (key !== '_id' && stage.$group[key].$sum) {
            if (stage.$group[key].$sum.$toDouble) {
              // Keep the $toDouble conversion as is
            }
          }
        })
      }
      
      return stage
    })
    
    // Execute the aggregation pipeline
    const result = await prisma.$runCommandRaw({
      aggregate: 'gifts', // Use gifts collection for most queries
      pipeline: aggregationPipeline,
      cursor: {}
    })

    // Process the results
    const documents = (result as any).cursor?.firstBatch || []
    
    if (documents.length === 0) {
      return {
        success: true,
        rows: [],
        columns: []
      }
    }

    // Handle $count operations specially
    if (aggregationPipeline.some(stage => stage.$count)) {
      const countResult = documents[0]
      return {
        success: true,
        rows: [countResult],
        columns: Object.keys(countResult).map(key => ({
          key,
          name: key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())
        }))
      }
    }

    // Extract column names from the first document
    const firstDoc = documents[0]
    const columns = Object.keys(firstDoc).map(key => ({
      key,
      name: key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())
    }))

    return {
      success: true,
      rows: documents,
      columns
    }

  } catch (error) {
    console.error('MongoDB aggregation error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
} 