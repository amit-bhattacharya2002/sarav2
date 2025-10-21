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

// Helper function to check if user is admin
function isUserAdmin(req: NextRequest): boolean {
  const userId = getUserIdFromRequest(req)
  const user = DEMO_USERS.find(u => u.id === userId)
  return user?.role === 'admin' || user?.role === 'legacy_admin'
}

// Helper function to check if user is regular user (not admin)
function isRegularUser(req: NextRequest): boolean {
  const userId = getUserIdFromRequest(req)
  const user = DEMO_USERS.find(u => u.id === userId)
  return user?.role === 'user'
}

export async function GET(req: NextRequest) {
  try {
    // Get queries based on user type
    const userId = getUserIdFromRequest(req)
    const isAdminUser = isUserAdmin(req)
    const isRegularUserType = isRegularUser(req)
    const companyId = 1
    
    let whereClause: any = { companyId }
    
    if (isAdminUser) {
      // Admin users see only their own content (blank slate)
      whereClause.userId = userId
    } else if (isRegularUserType) {
      // Demo users see only content created by admin users (not legacy_admin)
      // Get admin user IDs (role = 'admin')
      const adminUserIds = DEMO_USERS.filter(user => user.role === 'admin').map(user => user.id)
      whereClause.userId = { in: adminUserIds }
    } else {
      // Legacy admin users see all content
      // No additional where clause needed - show all
    }

    const queries = await businessPrisma.savedQuery.findMany({
      where: whereClause,
      orderBy: {
        createdAt: 'desc',
      },
      select: {
        id: true,
        userId: true,
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
