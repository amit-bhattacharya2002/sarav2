import { prisma } from './prisma'

export async function getSavedQueries(userId: number, companyId: number) {
  try {
    const queries = await prisma.savedQuery.findMany({
      where: {
        userId,
        companyId,
      },
      orderBy: {
        createdAt: 'desc',
      },
      select: {
        id: true,
        title: true,
        sqlText: true,
        queryText: true,
        outputMode: true,
        createdAt: true,
      },
    })

    return queries
  } catch (error) {
    console.error("Database error:", error)
    throw new Error(`Error loading saved queries: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

