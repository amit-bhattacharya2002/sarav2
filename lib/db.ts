import { businessPrisma } from './mysql-prisma'

export async function getSavedQueries(userId: number, companyId: number) {
  try {
    const queries = await businessPrisma.savedQuery.findMany({
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
        resultData: true,
        resultColumns: true,
        createdAt: true,
      },
    })

    return queries
  } catch (error) {
    console.error("Database error:", error)
    throw new Error(`Error loading saved queries: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

export async function getSavedDashboards(userId: number, companyId: number) {
  try {
    const dashboards = await businessPrisma.savedDashboard.findMany({
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
        quadrants: true,
        visualizations: true,
        sVisualizations: true,
        topLeftTitle: true,
        topRightTitle: true,
        bottomTitle: true,
        createdAt: true,
      },
    })

    return dashboards
  } catch (error) {
    console.error("Database error:", error)
    throw new Error(`Error loading saved dashboards: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

