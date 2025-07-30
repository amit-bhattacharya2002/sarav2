import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id')

  try {
    if (id) {
      // Fetch a specific dashboard by ID, including id in the result
      const dashboard = await prisma.savedDashboard.findUnique({
        where: { id },
        select: {
          id: true,
          title: true,
          quadrants: true,
          visualizations: true,
          sVisualizations: true,
          topLeftTitle: true,
          topRightTitle: true,
          bottomTitle: true,
        },
      })

      if (!dashboard) {
        return NextResponse.json({ error: 'Dashboard not found' }, { status: 404 })
      }

      return NextResponse.json({
        id: dashboard.id,
        title: dashboard.title,
        quadrants: JSON.parse(dashboard.quadrants || '{}'),
        visualizations: JSON.parse(dashboard.visualizations || '[]'),
        s_visualizations: JSON.parse(dashboard.sVisualizations || '[]'),
        topLeftTitle: dashboard.topLeftTitle || "Sample Title",
        topRightTitle: dashboard.topRightTitle || "Sample Title",
        bottomTitle: dashboard.bottomTitle || "Sample Title",
      })
      
    } else {
      // Fetch all dashboards for user_id=1 and company_id=1
      const dashboards = await prisma.savedDashboard.findMany({
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
        },
      })
      
      return NextResponse.json({ dashboards })
    }
  } catch (err: any) {
    console.error('[DASHBOARD_FETCH_ERROR]', err)
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const { id, title, quadrants, visualizations, s_visualizations, topLeftTitle, topRightTitle, bottomTitle } = await req.json();

    // Ensure id is only used if it's a valid ObjectId
    const dashboardId = id && id.length === 24 ? id : null;    

    if (dashboardId) {
      // Update existing dashboard
      const updatedDashboard = await prisma.savedDashboard.update({
        where: { id: dashboardId },
        data: {
          title,
          quadrants: JSON.stringify(quadrants),
          visualizations: JSON.stringify(visualizations),
          sVisualizations: JSON.stringify(s_visualizations),
          topLeftTitle,
          topRightTitle,
          bottomTitle,
        },
      });
      
      return NextResponse.json({ success: true, id: updatedDashboard.id });
    } else {
      // Insert new dashboard
      const newDashboard = await prisma.savedDashboard.create({
        data: {
          userId: 1, // user_id (hardcoded for now)
          companyId: 1, // company_id (hardcoded for now)
          title,
          quadrants: JSON.stringify(quadrants),
          visualizations: JSON.stringify(visualizations),
          sVisualizations: JSON.stringify(s_visualizations),
          topLeftTitle,
          topRightTitle,
          bottomTitle,
        },
      });
      
      return NextResponse.json({ success: true, id: newDashboard.id });
    }
  } catch (err: any) {
    console.error('[DASHBOARD_SAVE_ERROR]', err)
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 })
  }
}
