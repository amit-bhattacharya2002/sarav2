# 🔒 Security Documentation - Business Database Protection

## Overview

This document outlines the comprehensive security measures implemented to ensure **read-only access** to business data, particularly the `gifts` table.

## 🚫 Critical Protection Layers

### 1. Database-Level Protection

- **Read-Only Database User**: The MySQL user has SELECT privileges only
- **No Write Permissions**: Database user cannot INSERT, UPDATE, DELETE, or DROP
- **Connection String**: Uses `MYSQL_WRITE_DATABASE_URL` but user has read-only access

### 2. Prisma Client Protection

- **Read-Only Wrapper**: Custom Proxy wrapper prevents write operations on business tables
- **Blocked Operations**:
  - `create`, `createMany`
  - `update`, `updateMany`
  - `delete`, `deleteMany`
  - `upsert`
  - `executeRaw`, `queryRaw`
- **Protected Tables**: `gifts` and any other business data tables

### 3. SQL Query Validation

- **Real-time Validation**: Every SQL query is validated before execution
- **Write Operation Detection**: Blocks INSERT, UPDATE, DELETE, DROP, etc.
- **AI Query Validation**: Special validation for AI-generated queries
- **System Table Protection**: Blocks access to INFORMATION_SCHEMA, SYS tables

### 4. Application-Level Protection

- **Query Logging**: All queries are logged for monitoring
- **Error Handling**: Comprehensive error handling with security context
- **Warning System**: Non-blocking warnings for suspicious patterns

## 🔍 Validation Rules

### Allowed Operations

- ✅ `SELECT` queries only
- ✅ Read operations on business tables
- ✅ Aggregation functions (SUM, COUNT, etc.)
- ✅ JOIN operations between business tables

### Blocked Operations

- ❌ `INSERT` into business tables
- ❌ `UPDATE` business data
- ❌ `DELETE` from business tables
- ❌ `DROP` tables or databases
- ❌ `CREATE` new tables
- ❌ `ALTER` table structures
- ❌ `EXECUTE` stored procedures
- ❌ Access to system tables

## 📊 Monitoring & Logging

### Query Logging

```javascript
{
  timestamp: "2025-08-02T20:30:00.000Z",
  context: "AI_GENERATED" | "MANUAL",
  sql: "SELECT ACCOUNTID, SUM(GIFTAMOUNT)...",
  isValid: true,
  warnings: ["⚠️ SQL comments detected"]
}
```

### Error Logging

```javascript
{
  timestamp: "2025-08-02T20:30:00.000Z",
  context: "SQL_VALIDATION",
  sql: "UPDATE gifts SET...",
  isValid: false,
  error: "🚫 UPDATE OPERATION BLOCKED: Cannot update business data tables."
}
```

## 🛡️ Security Best Practices

### For Developers

1. **Never use `baseBusinessPrismaClient`** - only use `businessPrisma`
2. **Always validate SQL queries** before execution
3. **Log all database operations** for audit trails
4. **Test write operations** to ensure they're blocked

### For Database Administrators

1. **Use read-only database user** for application connections
2. **Monitor query logs** for suspicious activity
3. **Regular security audits** of database permissions
4. **Backup business data** regularly

## 🚨 Emergency Procedures

### If Write Access is Needed

1. **Create separate database user** with write permissions
2. **Use different connection string** for write operations
3. **Implement additional validation** for write operations
4. **Log all write operations** with user context

### If Security Breach is Suspected

1. **Immediately revoke application database access**
2. **Check query logs** for unauthorized operations
3. **Audit database permissions** and user accounts
4. **Restore from backup** if data was modified

## 📋 Security Checklist

- [ ] Database user has read-only permissions
- [ ] Prisma client wrapper is active
- [ ] SQL validation is enabled
- [ ] Query logging is working
- [ ] Write operations are blocked
- [ ] System table access is blocked
- [ ] AI query validation is active
- [ ] Error handling includes security context

## 🔧 Configuration

### Environment Variables

```bash
# Read-only business database
MYSQL_WRITE_DATABASE_URL="mysql://readonly_user:password@host:3306/database"

# Full access (emergency only)
MYSQL_FULL_ACCESS_URL="mysql://admin_user:password@host:3306/database"
```

### Validation Settings

```javascript
// lib/sql-validator.ts
const READ_ONLY_TABLES = [
  "gifts", // Main business data - CRITICAL
  // Add other business tables here
];

const WRITE_OPERATIONS = [
  "INSERT",
  "UPDATE",
  "DELETE",
  "DROP",
  "TRUNCATE",
  "ALTER",
  "CREATE",
  "RENAME",
  "GRANT",
  "REVOKE",
];
```

## 📞 Security Contacts

- **Database Administrator**: [Contact Info]
- **Application Security**: [Contact Info]
- **Emergency Response**: [Contact Info]

---

**⚠️ IMPORTANT**: This system is designed to be **bulletproof** against accidental or malicious write operations to business data. Any attempt to modify these protections should be thoroughly reviewed and tested.
