import { openai } from "@ai-sdk/openai"
import { generateText } from "ai"

// Database schema definition
const DB_SCHEMA = `
Table: gifts

- id (integer): Primary key.
- GIFTDATE (date): The date the gift was received.
- GIFTAMOUNT (decimal): The amount of the gift.
- TRANSACTIONTYPE (varchar): Type of transaction (e.g., Gift, Pledge).
- GIFTTYPE (varchar): Type of gift (e.g., Single, Recurring).
- PAYMENTMETHOD (varchar): Payment method (e.g., Credit Card, Check).
- SOFTCREDITINDICATOR (varchar): Whether the gift was soft-credited.
- SOFTCREDITAMOUNT (decimal): Amount soft-credited.
- SOURCECODE (varchar): Campaign or appeal source code — examples include: 
  Phone Call, Direct Mail, Personal Solicitation, Web Gift, Event, Web Gift Mail, Useed, 
  VRIOUS, DIRMAIL, Other, Campus Campaign, Unsolicited, Email, Coffee Club, Faculty
  Newsletter, UNITWAY, Sponsorship, Athletics, United Way, FRISFU, ATHCOMM, WRESCOM, 
  Telemarketing, Proposal, SPONSRP, NEWSLET, Payroll.
- DESIGNATION (text): The specific fund or initiative the gift was designated to — e.g., "88 Keys Campaign", "Student Bursaries Fund", "Engineering Equipment Endowment".
- UNIT (varchar): The organizational department or division that received the gift. Example: "UA - University Advancement".
- PURPOSECATEGORY (varchar): The classification of the gift's intent or use — e.g., "Endowment", "Operating", "Capital Project".
- APPEAL (varchar): The specific fundraising effort or campaign code. Examples: "CUAGENXX", "AALGEN871", "AALGEN881", "AALGEN891".
- GIVINGLEVEL (varchar): The dollar tier or range of the gift. Examples include "$1-$99.99", "$100-$499.99", "$500-$999.99", "$1,000+".
`

export async function generateSqlQuery(userQuestion: string): Promise<string> {
  const prompt = `
You are an expert SQL query generator. Based on the following database schema, generate a SQL query that answers the user's question.
Only return the SQL query without any explanation or markdown formatting.

${DB_SCHEMA}

User question: ${userQuestion}

SQL query:
`

  try {
    const { text } = await generateText({
      model: openai("gpt-4o"),
      prompt: prompt,
      temperature: 0.2, // Lower temperature for more deterministic SQL generation
      maxTokens: 500,
    })

    // Clean up the response to ensure it's just SQL
    let sql = text.trim()
    if (sql.toLowerCase().startsWith("sql")) {
      sql = sql.substring(3).trim()
    }
    if (sql.startsWith("```sql")) {
      sql = sql.substring(6).trim()
    }
    if (sql.endsWith("```")) {
      sql = sql.substring(0, sql.length - 3).trim()
    }

    return sql
  } catch (error) {
    console.error("Error generating SQL query:", error)
    throw new Error(`Failed to generate SQL query: ${error.message}`)
  }
}
