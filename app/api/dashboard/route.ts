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
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    const isShared = searchParams.get('shared') === 'true'

    if (id) {
      // Get specific dashboard
      const dashboard = await businessPrisma.savedDashboard.findUnique({
        where: {
          id: parseInt(id)
        },
        select: {
          id: true,
          userId: true,
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

      if (!dashboard) {
        return NextResponse.json({ error: 'Dashboard not found' }, { status: 404 })
      }

      // For shared dashboards, skip user authorization check
      if (!isShared) {
        const userId = getUserIdFromRequest(req)
        const currentUser = DEMO_USERS.find(u => u.id === userId)
        const isAdminUser = currentUser?.role === 'admin' || currentUser?.role === 'legacy_admin'
        const isRegularUser = currentUser?.role === 'user'
        
        if (isAdminUser) {
          // Admin users can only access their own dashboards
          if (dashboard.userId !== userId) {
            return NextResponse.json({ error: 'Dashboard not found or unauthorized' }, { status: 404 })
          }
        } else if (isRegularUser) {
          // Demo users can access dashboards created by admin users
          const adminUserIds = DEMO_USERS.filter(user => user.role === 'admin').map(user => user.id)
          if (!adminUserIds.includes(dashboard.userId)) {
            return NextResponse.json({ error: 'Dashboard not found or unauthorized' }, { status: 404 })
          }
        } else {
          // Legacy admin users can access all dashboards
          // No additional check needed
        }
      }
      // If isShared is true, skip all permission checks and return the dashboard

      return NextResponse.json({ dashboard })
    } else {
      // Get dashboards based on user type
      const userId = getUserIdFromRequest(req)
      const isAdminUser = isUserAdmin(req)
      const isRegularUserType = isRegularUser(req)
      
      let whereClause: any = { companyId: 1 }
      
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
      
      const dashboards = await businessPrisma.savedDashboard.findMany({
        where: whereClause,
        orderBy: {
          createdAt: 'desc',
        },
        select: {
          id: true,
          userId: true,
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

      return NextResponse.json({ dashboards })
    }
  } catch (error: any) {
    console.error('[DASHBOARD_ERROR]', error)
    return NextResponse.json({ error: 'Failed to load dashboard(s)' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    // Check if user has admin permissions for save/update operations
    if (!isUserAdmin(req)) {
      return NextResponse.json({ 
        error: 'This option is not available for demo purpose. Only admin users can save and update dashboards.' 
      }, { status: 403 })
    }

    const body = await req.json()
    const { action, dashboardId, title, quadrants, visualizations, sVisualizations, s_visualizations, topLeftTitle, topRightTitle, bottomTitle } = body

    // Handle both field name formats
    const sVisualizationsData = sVisualizations || s_visualizations

    if (action === 'update' && dashboardId) {
      // Update existing dashboard
      const updatedDashboard = await businessPrisma.savedDashboard.update({
        where: {
          id: parseInt(dashboardId)
        },
        data: {
          title,
          quadrants: JSON.stringify(quadrants),
          visualizations: JSON.stringify(visualizations),
          sVisualizations: JSON.stringify(sVisualizationsData),
          topLeftTitle,
          topRightTitle,
          bottomTitle,
        },
      })

      return NextResponse.json({ success: true, dashboard: updatedDashboard })
    } else {
      // Create new dashboard
      const userId = getUserIdFromRequest(req)
      const newDashboard = await businessPrisma.savedDashboard.create({
        data: {
          userId,
          companyId: 1,
          title,
          quadrants: JSON.stringify(quadrants),
          visualizations: JSON.stringify(visualizations),
          sVisualizations: JSON.stringify(sVisualizationsData),
          topLeftTitle,
          topRightTitle,
          bottomTitle,
        },
      })

      return NextResponse.json({ success: true, dashboard: newDashboard })
    }
  } catch (error: any) {
    console.error('[DASHBOARD_ERROR]', error)
    return NextResponse.json({ error: 'Failed to save dashboard' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    // Check if user has admin permissions for delete operations
    if (!isUserAdmin(req)) {
      return NextResponse.json({ 
        error: 'This option is not available for demo purpose. Only admin users can delete dashboards.' 
      }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const dashboardId = searchParams.get('id')

    if (!dashboardId) {
      return NextResponse.json({ error: 'Dashboard ID is required' }, { status: 400 })
    }

    const userId = getUserIdFromRequest(req)

    // First check if the dashboard exists and belongs to the user
    const dashboard = await businessPrisma.savedDashboard.findUnique({
      where: {
        id: parseInt(dashboardId)
      },
      select: {
        id: true,
        userId: true,
      },
    })

    if (!dashboard) {
      return NextResponse.json({ error: 'Dashboard not found' }, { status: 404 })
    }

    if (dashboard.userId !== userId) {
      return NextResponse.json({ error: 'Unauthorized to delete this dashboard' }, { status: 403 })
    }

    // Delete the dashboard
    await businessPrisma.savedDashboard.delete({
      where: {
        id: parseInt(dashboardId)
      },
    })

    return NextResponse.json({ success: true, message: 'Dashboard deleted successfully' })
  } catch (error: any) {
    console.error('[DASHBOARD_DELETE_ERROR]', error)
    return NextResponse.json({ error: 'Failed to delete dashboard' }, { status: 500 })
  }
}
