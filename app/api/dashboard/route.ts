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
        if (dashboard.userId !== userId) {
          return NextResponse.json({ error: 'Dashboard not found or unauthorized' }, { status: 404 })
        }
      }

      return NextResponse.json({ dashboard })
    } else {
      // Get all dashboards (only for authenticated users, not for shared access)
      const userId = getUserIdFromRequest(req)
      const dashboards = await businessPrisma.savedDashboard.findMany({
        where: {
          userId,
          companyId: 1,
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

      return NextResponse.json({ dashboards })
    }
  } catch (error: any) {
    console.error('[DASHBOARD_ERROR]', error)
    return NextResponse.json({ error: 'Failed to load dashboard(s)' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
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
