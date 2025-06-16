"use server"

import mysql from "mysql2/promise"

// Database connection configuration
const dbConfig = {
  host: "srv688.hstgr.io",
  port: 3306,
  user: "u848738634_gbuser2",
  password: "8DfU%#7gNbFf$U-",
  database: "u848738634_aitest2",
}

export async function executeSqlQuery(sql: string) {
  try {
    // Create a connection
    const connection = await mysql.createConnection(dbConfig)

    // Execute the query
    const [rows, fields] = await connection.execute(sql)

    // Close the connection
    await connection.end()

    // Process column names
    const columns = fields
      ? fields.map((field) => ({
          key: field.name,
          name: field.name.replace("_", " ").replace(/\b\w/g, (l) => l.toUpperCase()),
        }))
      : []

    // Clean up data
    const cleanedRows = Array.isArray(rows)
      ? rows.map((row) => {
          const cleanedRow: Record<string, any> = {}
          Object.entries(row).forEach(([key, value]) => {
            if (value instanceof Buffer) {
              cleanedRow[key] = value.readInt8(0) // Convert Buffer to number
            } else if (typeof value === "string" && value.startsWith("b'") && value.length <= 6) {
              cleanedRow[key] = value === "b'\\x00'" ? 0 : value === "b'\\x01'" ? 1 : value
            } else {
              cleanedRow[key] = value
            }
          })
          return cleanedRow
        })
      : []

    return {
      success: true,
      data: cleanedRows,
      columns: columns,
    }
  } catch (error) {
    console.error("Database error:", error)
    return {
      success: false,
      error: error.message,
    }
  }
}
