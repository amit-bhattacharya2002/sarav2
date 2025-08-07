# Dual Database Architecture

This project uses a dual database architecture with read-only access to business data:

## 🗄️ Database Setup

### 1. MongoDB (Auth Database)

- **Purpose**: User authentication, saved queries, saved dashboards, schema definitions
- **URL**: `AUTH_DATABASE_URL`
- **Schema**: `prisma/auth-schema.prisma`
- **Client**: `lib/auth-prisma.ts`
- **Access**: Read/Write (for saved queries and dashboards)

### 2. MySQL (Business Database) - READ ONLY

- **Purpose**: Business data (constituents, gifts, addresses)
- **URL**: `BUSINESS_DATABASE_URL`
- **Schema**: `prisma/business-schema.prisma`
- **Client**: `lib/business-prisma.ts`
- **Access**: Read-Only (SELECT queries only)
- **Security**: All queries are validated to ensure read-only access

## 🔧 Setup Instructions

### 1. Environment Variables

Create a `.env` file with both database URLs:

```env
# MongoDB for authentication and user data
AUTH_DATABASE_URL="mongodb+srv://username:password@cluster.mongodb.net/sara_auth?retryWrites=true&w=majority"

# MySQL for business data (READ ONLY)
BUSINESS_DATABASE_URL="mysql://username:password@localhost:3306/sara_business"

OPENAI_API_KEY="your-openai-api-key"
```

### 2. Generate Prisma Clients

```bash
npm run db:generate
```

### 3. Push Database Schemas

```bash
# Push auth database (MongoDB)
npm run db:push:auth

# Push business database (MySQL) - Schema only, no data seeding
npm run db:push:business
```

**Note**: No seeding is required as both databases already contain data.

## 📁 File Structure

```
prisma/
├── auth-schema.prisma      # MongoDB schema for auth/user data
└── business-schema.prisma  # MySQL schema for business data (READ ONLY)

lib/
├── auth-prisma.ts         # MongoDB Prisma client
├── business-prisma.ts     # MySQL Prisma client (READ ONLY)
├── sql-query.ts          # SQL query execution (with safety checks)
└── db.ts                 # Database access functions

app/api/
├── query/route.ts         # Query execution (SQL - READ ONLY)
├── generate-sql/route.ts  # SQL generation (SELECT only)
└── dashboard/route.ts     # Dashboard management
```

## 🔄 Key Changes

### Database Access

- **Auth operations**: Use `authPrisma` client (Read/Write)
- **Business queries**: Use `businessPrisma` client (Read-Only)
- **SQL execution**: Use `executeSQLQuery()` function with safety checks

### Security Features

- **Query Validation**: Only SELECT queries are allowed
- **Keyword Blocking**: Dangerous SQL keywords are blocked
- **Read-Only Enforcement**: No INSERT, UPDATE, DELETE operations

### Query Generation

- **Before**: MongoDB aggregation pipelines
- **After**: SQL queries for MySQL (SELECT only)

### Data Types

- **Before**: String amounts for MongoDB
- **After**: Decimal amounts for MySQL

## 🚀 Usage

### Running Queries

The system generates and executes SQL queries with read-only safety:

```sql
-- Example: Top donors (READ ONLY)
SELECT
  c.firstName,
  c.lastName,
  CONCAT(c.firstName, ' ', c.lastName) as donor,
  SUM(CAST(g.giftAmount AS DECIMAL(10,2))) as totalAmount
FROM constituents c
JOIN gifts g ON c.constituentId = g.constituentId
GROUP BY c.constituentId, c.firstName, c.lastName
ORDER BY totalAmount DESC
LIMIT 10
```

### Saved Queries & Dashboards

- Stored in MongoDB (auth database)
- No business data in auth database
- Clean separation of concerns

## 🔍 Database Studio

```bash
# View auth database (MongoDB)
npm run db:studio:auth

# View business database (MySQL) - READ ONLY
npm run db:studio:business
```

## ⚠️ Important Notes

1. **MySQL Setup**: Ensure MySQL is installed and running
2. **Database Creation**: The `sara_business` database should already exist with data
3. **Prisma Clients**: Must be generated before running the application
4. **Environment Variables**: Both database URLs are required
5. **Read-Only Access**: Business database is protected against write operations
6. **No Seeding**: Both databases already contain data

## 🛠️ Troubleshooting

### Common Issues

1. **Prisma Client Not Found**

   ```bash
   npm run db:generate
   ```

2. **Database Connection Errors**

   - Check database URLs in `.env`
   - Ensure databases exist and are accessible
   - Verify network connectivity

3. **Schema Push Errors**

   - Run schema pushes separately
   - Check database permissions
   - Ensure business database exists

4. **Read-Only Query Errors**
   - Only SELECT queries are allowed
   - Check for blocked keywords in queries
   - Verify query syntax

## 🔒 Security Features

### Query Safety

- **SELECT Only**: All queries must start with SELECT
- **Keyword Blocking**: Dangerous SQL keywords are blocked
- **Input Validation**: SQL queries are validated before execution

### Blocked Keywords

- INSERT, UPDATE, DELETE
- DROP, CREATE, ALTER, TRUNCATE
- GRANT, REVOKE, EXECUTE, CALL
- LOCK, UNLOCK

### Error Handling

- Clear error messages for blocked operations
- Logging of all query attempts
- Graceful failure for invalid queries
