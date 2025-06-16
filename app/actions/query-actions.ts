"use server"

import { getSavedQueries } from "@/lib/db" // ✅ uses real DB logic

export async function fetchSavedQueries(userId: number, companyId: number) {
  try {
    const queries = await getSavedQueries(userId, companyId)
    // console.log("🧠 DB result full JSON:", JSON.stringify(queries, null, 2))

    return {
      success: true,
      data: queries,
    }
  } catch (error) {
    console.error("Error fetching saved queries:", error)
    return {
      success: false,
      error: error.message,
      message: "Error occurred while fetching saved queries",
    }
  }
}
