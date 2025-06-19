import { NextRequest, NextResponse } from 'next/server'
import mysql from 'mysql2/promise'

const dbConfig = {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: 3306,
}

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id')

  try {
    const connection = await mysql.createConnection(dbConfig)

    if (id) {
      // Fetch a specific dashboard by ID, including id in the result
      const [rows] = await connection.execute(
        `SELECT id, title, quadrants, visualizations, s_visualizations FROM saved_dashboards WHERE id = ?`,
        [id]
      )
      await connection.end()

      if (!rows || rows.length === 0) {
        return NextResponse.json({ error: 'Dashboard not found' }, { status: 404 })
      }

      const dashboard = rows[0] as any

      return NextResponse.json({
        id: dashboard.id,
        title: dashboard.title,
        quadrants: JSON.parse(dashboard.quadrants || '{}'),
        visualizations: JSON.parse(dashboard.visualizations || '[]'),
        s_visualizations: JSON.parse(dashboard.s_visualizations || '[]'),
      })
    } else {
      // Fetch all dashboards for user_id=1 and company_id=1
      const [rows] = await connection.execute(
        `SELECT id, title FROM saved_dashboards WHERE user_id = 1 AND company_id = 1 ORDER BY created_at DESC`
      )
      await connection.end()
      return NextResponse.json({ dashboards: rows })
    }
  } catch (err: any) {
    console.error('[DASHBOARD_FETCH_ERROR]', err)
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const { id, title, quadrants, visualizations, s_visualizations } = await req.json();

    const connection = await mysql.createConnection(dbConfig);

    if (id) {
      // Update existing dashboard
      await connection.execute(
        `UPDATE saved_dashboards SET title = ?, quadrants = ?, visualizations = ?, s_visualizations = ? WHERE id = ?`,
        [
          title,
          JSON.stringify(quadrants),
          JSON.stringify(visualizations),
          JSON.stringify(s_visualizations),
          id,
        ]
      );
      await connection.end();
      return NextResponse.json({ success: true, id }); // <-- also return id on update
    } else {
      // Insert new dashboard
      const [result]: any = await connection.execute(
        `INSERT INTO saved_dashboards (user_id, company_id, title, quadrants, visualizations, s_visualizations) VALUES (?, ?, ?, ?, ?, ?)`,
        [
          1, // user_id (hardcoded for now)
          1, // company_id (hardcoded for now)
          title,
          JSON.stringify(quadrants),
          JSON.stringify(visualizations),
          JSON.stringify(s_visualizations),
        ]
      );
      await connection.end();
      return NextResponse.json({ success: true, id: result.insertId }); // <-- return new id!
    }
  } catch (err: any) {
    console.error('[DASHBOARD_SAVE_ERROR]', err)
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 })
  }
}
