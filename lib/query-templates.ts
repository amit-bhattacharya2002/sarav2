/**
 * Query Templates for Complex Analytical Queries
 * 
 * This file contains pre-built SQL templates for common analytical patterns
 * that can be used to handle complex natural language queries.
 */

export interface QueryTemplate {
  pattern: RegExp
  template: (matches: RegExpMatchArray) => string
  description: string
}

export const ANALYTICAL_QUERY_TEMPLATES: QueryTemplate[] = [
  // Trend & Pattern Analysis
  {
    pattern: /is there a relationship between (\w+)\s+and\s+(\w+)/i,
    template: (matches) => {
      const field1 = matches[1].toLowerCase()
      const field2 = matches[2].toLowerCase()
      
      const field1Col = getFieldColumn(field1)
      const field2Col = getFieldColumn(field2)
      
      if (field1Col && field2Col) {
        return `
SELECT TOP 50
  h.Staff_ID AS 'Staff ID',
  h.Department AS 'Department',
  ${field1Col} AS '${field1.charAt(0).toUpperCase() + field1.slice(1)}',
  ${field2Col} AS '${field2.charAt(0).toUpperCase() + field2.slice(1)}'
FROM healthstaff_schedule h
WHERE ${field1Col} IS NOT NULL AND ${field2Col} IS NOT NULL
ORDER BY ${field1Col} DESC`
      }
      return ''
    },
    description: 'Shows relationship between two fields'
  },

  // Staff with specific conditions
  {
    pattern: /staff members with more than (\d+)\s+(\w+)\s+and\s+(\w+)\s+below\s+(\d+)/i,
    template: (matches) => {
      const threshold1 = matches[1]
      const field1 = matches[2].toLowerCase()
      const field2 = matches[3].toLowerCase()
      const threshold2 = matches[4]
      
      const field1Col = getFieldColumn(field1)
      const field2Col = getFieldColumn(field2)
      
      if (field1Col && field2Col) {
        return `
SELECT TOP 50
  h.Staff_ID AS 'Staff ID',
  h.Department AS 'Department',
  ${field1Col} AS '${field1.charAt(0).toUpperCase() + field1.slice(1)}',
  ${field2Col} AS '${field2.charAt(0).toUpperCase() + field2.slice(1)}'
FROM healthstaff_schedule h
WHERE ${field1Col} > ${threshold1} AND ${field2Col} < ${threshold2}
ORDER BY ${field1Col} DESC`
      }
      return ''
    },
    description: 'Finds staff with specific conditions'
  },

  // Department comparisons
  {
    pattern: /compare (\w+)\s+and\s+(\w+)\s+in terms of\s+(.+)/i,
    template: (matches) => {
      const dept1 = matches[1]
      const dept2 = matches[2]
      const metrics = matches[3].toLowerCase()
      
      let selectFields = 'h.Department AS \'Department\', COUNT(h.Staff_ID) AS \'Staff Count\''
      let orderFields = 'AVG(h.Satisfaction_Score) DESC'
      
      if (metrics.includes('satisfaction')) {
        selectFields += ', AVG(h.Satisfaction_Score) AS \'Average Satisfaction\''
      }
      if (metrics.includes('overtime')) {
        selectFields += ', AVG(h.Overtime_Hours) AS \'Average Overtime\''
      }
      if (metrics.includes('experience')) {
        selectFields += ', AVG(h.Years_of_Experience) AS \'Average Experience\''
      }
      if (metrics.includes('patient') || metrics.includes('load')) {
        selectFields += ', AVG(h.Patient_Load) AS \'Average Patient Load\''
      }
      
      return `
SELECT
  ${selectFields}
FROM healthstaff_schedule h
WHERE h.Department IN ('${dept1}', '${dept2}')
GROUP BY h.Department
ORDER BY ${orderFields}`
    },
    description: 'Compares two departments on specified metrics'
  },

  // Experience grouping
  {
    pattern: /average satisfaction by years of experience group/i,
    template: () => `
SELECT
  CASE 
    WHEN h.Years_of_Experience <= 5 THEN '0-5 years'
    WHEN h.Years_of_Experience <= 10 THEN '6-10 years'
    ELSE '10+ years'
  END AS 'Experience Group',
  AVG(h.Satisfaction_Score) AS 'Average Satisfaction',
  COUNT(h.Staff_ID) AS 'Staff Count',
  AVG(h.Overtime_Hours) AS 'Average Overtime',
  AVG(h.Patient_Load) AS 'Average Patient Load'
FROM healthstaff_schedule h
WHERE h.Years_of_Experience IS NOT NULL
GROUP BY 
  CASE 
    WHEN h.Years_of_Experience <= 5 THEN '0-5 years'
    WHEN h.Years_of_Experience <= 10 THEN '6-10 years'
    ELSE '10+ years'
  END
ORDER BY AVG(h.Satisfaction_Score) DESC`,
    description: 'Groups staff by experience ranges and shows averages'
  },

  // Satisfaction drop analysis
  {
    pattern: /departments with largest drop in satisfaction/i,
    template: () => `
SELECT
  h.Department AS 'Department',
  AVG(h.Satisfaction_Score) AS 'Current Satisfaction',
  AVG(h.Previous_Satisfaction_Rating) AS 'Previous Satisfaction',
  AVG(h.Previous_Satisfaction_Rating) - AVG(h.Satisfaction_Score) AS 'Satisfaction Drop',
  COUNT(h.Staff_ID) AS 'Staff Count'
FROM healthstaff_schedule h
WHERE h.Department IS NOT NULL 
  AND h.Previous_Satisfaction_Rating IS NOT NULL
GROUP BY h.Department
ORDER BY AVG(h.Previous_Satisfaction_Rating) - AVG(h.Satisfaction_Score) DESC`,
    description: 'Shows departments with largest satisfaction drops'
  },

  // High pressure departments
  {
    pattern: /departments under the most pressure/i,
    template: () => `
SELECT
  h.Department AS 'Department',
  AVG(h.Patient_Load) AS 'Average Patient Load',
  AVG(h.Overtime_Hours) AS 'Average Overtime',
  AVG(h.Satisfaction_Score) AS 'Average Satisfaction',
  COUNT(h.Staff_ID) AS 'Staff Count'
FROM healthstaff_schedule h
WHERE h.Department IS NOT NULL
GROUP BY h.Department
ORDER BY (AVG(h.Patient_Load) + AVG(h.Overtime_Hours)) DESC`,
    description: 'Shows departments under the most pressure'
  },

  // Overworked staff
  {
    pattern: /most overworked employees by patient load/i,
    template: () => `
SELECT TOP 20
  h.Staff_ID AS 'Staff ID',
  h.Department AS 'Department',
  h.Patient_Load AS 'Patient Load',
  h.Overtime_Hours AS 'Overtime Hours',
  h.Satisfaction_Score AS 'Satisfaction Score',
  h.Years_of_Experience AS 'Years of Experience'
FROM healthstaff_schedule h
WHERE h.Patient_Load IS NOT NULL
ORDER BY h.Patient_Load DESC, h.Overtime_Hours DESC`,
    description: 'Shows most overworked staff by patient load'
  }
]

// Helper function to map field names to database columns
function getFieldColumn(field: string): string {
  const fieldLower = field.toLowerCase()
  
  if (fieldLower.includes('overtime')) return 'h.Overtime_Hours'
  if (fieldLower.includes('satisfaction')) return 'h.Satisfaction_Score'
  if (fieldLower.includes('experience') || fieldLower.includes('years')) return 'h.Years_of_Experience'
  if (fieldLower.includes('patient') || fieldLower.includes('load')) return 'h.Patient_Load'
  if (fieldLower.includes('absenteeism')) return 'h.Absenteeism_Days'
  if (fieldLower.includes('shift') || fieldLower.includes('duration')) return 'h.Shift_Duration_Hours'
  if (fieldLower.includes('workdays')) return 'h.Workdays_per_Month'
  
  return ''
}

// Function to find matching template
export function findMatchingTemplate(query: string): string | null {
  for (const template of ANALYTICAL_QUERY_TEMPLATES) {
    const match = query.match(template.pattern)
    if (match) {
      return template.template(match)
    }
  }
  return null
}
