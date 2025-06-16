import mysql from "mysql2/promise"

// Database connection configuration
const dbConfig = {
  host: "srv688.hstgr.io",
  port: 3306,
  user: "u848738634_gbuser2",
  password: "8DfU%#7gNbFf$U-",
  database: "u848738634_aitest2",
}

// Create a connection pool
const pool = mysql.createPool(dbConfig)

export async function getSavedQueries(userId: number, companyId: number) {
  try {
    const [rows] = await pool.query(
      `SELECT title, sql_text, query_text, output_mode
       FROM saved_queries
       WHERE user_id = ? AND company_id = ?
       ORDER BY created_at DESC`,
      [userId, companyId],
    )

    return rows
  } catch (error) {
    console.error("Database error:", error)
    throw new Error(`Error loading saved queries: ${error.message}`)
  }
}

