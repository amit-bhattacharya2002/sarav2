// File: app/api/saved-queries/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  try {
    const userId = 1
    const companyId = 1

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
        resultData: true,
        resultColumns: true,
        createdAt: true,
      },
    })

    return NextResponse.json({ queries })
  } catch (error: any) {
    console.error('[LOAD_SAVED_QUERIES_ERROR]', error)
    return NextResponse.json({ error: 'Failed to load saved queries.' }, { status: 500 })
  }
}
