// Mock database service that simulates fetching from a MySQL database
// This is used because v0 doesn't support mysql2

// Mock saved queries data
export const mockSavedQueries = [
  {
    id: 1,
    title: "Monthly Sales Analysis",
    sql_text: "SELECT product_name, SUM(sales) FROM sales GROUP BY product_name",
    output_mode: "chart",
    created_at: "2023-05-10T14:30:00Z",
    user_id: 1,
    company_id: 1,
  },
  {
    id: 2,
    title: "Customer Demographics",
    sql_text: "SELECT age_group, COUNT(*) FROM customers GROUP BY age_group",
    output_mode: "table",
    created_at: "2023-05-09T10:15:00Z",
    user_id: 1,
    company_id: 1,
  },
  {
    id: 3,
    title: "Revenue by Region",
    sql_text: "SELECT region, SUM(revenue) FROM sales GROUP BY region ORDER BY SUM(revenue) DESC",
    output_mode: "chart",
    created_at: "2023-05-08T16:45:00Z",
    user_id: 1,
    company_id: 1,
  },
  {
    id: 4,
    title: "Product Performance Q1",
    sql_text:
      "SELECT product_id, product_name, SUM(sales) FROM sales WHERE quarter = 'Q1' GROUP BY product_id, product_name",
    output_mode: "table",
    created_at: "2023-05-07T09:20:00Z",
    user_id: 1,
    company_id: 1,
  },
  {
    id: 5,
    title: "Marketing Campaign Results",
    sql_text: "SELECT campaign_name, SUM(conversions) FROM marketing_campaigns GROUP BY campaign_name",
    output_mode: "chart",
    created_at: "2023-05-06T11:30:00Z",
    user_id: 1,
    company_id: 1,
  },
]

// Simulate database query with delay
export async function getSavedQueries(userId: number, companyId: number) {
  // Simulate network delay
  await new Promise((resolve) => setTimeout(resolve, 500))

  // Filter queries by user_id and company_id
  return mockSavedQueries.filter((query) => query.user_id === userId && query.company_id === companyId)
}
