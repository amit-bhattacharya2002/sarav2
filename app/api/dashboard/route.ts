import { NextRequest, NextResponse } from 'next/server'
import { businessPrisma } from '@/lib/mysql-prisma'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')

    if (id) {
      // Get specific dashboard
      const dashboard = await businessPrisma.savedDashboard.findUnique({
        where: {
          id: parseInt(id)
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

      if (!dashboard) {
        return NextResponse.json({ error: 'Dashboard not found' }, { status: 404 })
      }

      return NextResponse.json({ dashboard })
    } else {
      // Get all dashboards
      const dashboards = await businessPrisma.savedDashboard.findMany({
        where: {
          userId: 1,
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
      const newDashboard = await businessPrisma.savedDashboard.create({
        data: {
          userId: 1,
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
