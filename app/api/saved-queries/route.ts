// File: app/api/saved-queries/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { businessPrisma } from '@/lib/mysql-prisma'
import { DEMO_USERS } from '@/lib/auth'

// Helper function to get user ID from request headers
function getUserIdFromRequest(req: NextRequest): number {
  const userIdHeader = req.headers.get('x-user-id')
  if (userIdHeader) {
    const userId = parseInt(userIdHeader)
    // Verify the user exists in our demo users
    const userExists = DEMO_USERS.some(user => user.id === userId)
    return userExists ? userId : 1 // Default to user 1 if invalid
  }
  return 1 // Default to user 1 if no header
}

export async function GET(req: NextRequest) {
  try {
    const userId = getUserIdFromRequest(req)
    const companyId = 1

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

    return NextResponse.json({ queries })
  } catch (error: any) {
    console.error('[LOAD_SAVED_QUERIES_ERROR]', error)
    return NextResponse.json({ error: 'Failed to load saved queries.' }, { status: 500 })
  }
}
