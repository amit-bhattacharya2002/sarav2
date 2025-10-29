# SARA v2 Database Setup Guide

This guide explains how to set up the completely isolated database configuration for SARA v2, ensuring no risk to your existing production database.

## 🚨 Database Isolation Overview

SARA v2 uses **one separate database** to ensure complete isolation from your existing production system:

**SARA v2 Database** (`SARAV2_DATABASE_URL`)
- Contains both your business data (constituents, gifts) and application data (saved queries, dashboards)
- Completely separate from your current production database
- Read-only access to business data tables to prevent accidental modification
- Full read/write access to application data tables for functionality

## 📋 Prerequisites

- One separate MySQL database (completely different from your production database)
- Database credentials for the new database
- Access to create tables and manage permissions

## 🗄️ Database Setup

### Step 1: Create Your Database

Create one separate database on your MySQL server:

```sql
-- Create the SARA v2 database (completely separate from production)
CREATE DATABASE sarav2_database CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

### Step 2: Set Up Database User (Recommended)

Create a user with appropriate permissions:

```sql
-- SARA v2 database user
CREATE USER 'sarav2_user'@'%' IDENTIFIED BY 'your_secure_password';
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, DROP, ALTER ON sarav2_database.* TO 'sarav2_user'@'%';

-- Apply changes
FLUSH PRIVILEGES;
```

### Step 3: Import Your Business Data

Import your business data into the `sarav2_database` database:

```bash
# Export from your current database (if needed)
mysqldump -u username -p current_database_name > business_data_backup.sql

# Import into the new SARA v2 database
mysql -u sarav2_user -p sarav2_database < business_data_backup.sql
```

## ⚙️ Environment Configuration

### Step 1: Create Environment File

Copy the template and configure your databases:

```bash
cp env.template .env.local
```

### Step 2: Configure Database URL

Edit `.env.local` with your new database connection:

```env
# SARA v2 Database Configuration
SARAV2_DATABASE_URL="mysql://sarav2_user:your_password@your_host:3306/sarav2_database"

# Optional: Legacy database reference (if you need to access old data)
# LEGACY_DATABASE_URL="mysql://username:password@host:3306/legacy_database"
```

## 🚀 Application Setup

### Step 1: Generate Prisma Client

Generate the Prisma client for your database:

```bash
# Generate Prisma client
npm run db:generate
```

### Step 2: Push Database Schema

Create the necessary tables in your database:

```bash
# Push database schema (creates all tables)
npm run db:push
```

### Step 3: Test Database Isolation

Run the isolation test to verify everything is working correctly:

```bash
npm run test-db-isolation
```

This will verify:
- ✅ Environment variables are set correctly
- ✅ Databases are properly separated
- ✅ Business database is read-only
- ✅ App database is accessible
- ✅ No accidental production database access

## 🔒 Security Features

### Read-Only Business Database

The business database is configured with read-only access:

- **No write operations** allowed on business data
- **Automatic blocking** of create, update, delete operations
- **Error messages** if write operations are attempted
- **Complete isolation** from production data

### Database Separation

- **Different connection strings** for each database
- **Separate Prisma clients** for each database
- **Independent schemas** and migrations
- **No shared tables** between databases

## 🧪 Testing Your Setup

### 1. Test Database Connections

```bash
# Test business database (should be read-only)
npm run db:studio:business

# Test app database (should allow read/write)
npm run db:studio:app
```

### 2. Test Application Functionality

```bash
# Start the development server
npm run dev

# Test querying business data
# Test saving queries and dashboards
# Verify no data is written to business database
```

### 3. Verify Isolation

The isolation test will check:

- Environment variables are properly configured
- Databases are separate and accessible
- Business database blocks write operations
- App database allows necessary operations
- No legacy database references

## 🚨 Safety Checklist

Before deploying to production:

- [ ] **Separate databases created** and configured
- [ ] **Environment variables set** with correct URLs
- [ ] **Database isolation test passes** (`npm run test-db-isolation`)
- [ ] **Business data imported** into v2 business database
- [ ] **App database tables created** and accessible
- [ ] **No legacy database references** in environment
- [ ] **Read-only permissions** verified on business database
- [ ] **Backup strategy** in place for both databases

## 🔧 Troubleshooting

### Common Issues

#### Database Connection Errors

```bash
# Check if databases exist
mysql -u username -p -e "SHOW DATABASES;"

# Test connection strings
mysql -u sarav2_business -p -h your_host sarav2_business_db
mysql -u sarav2_app -p -h your_host sarav2_app_db
```

#### Prisma Client Issues

```bash
# Regenerate clients
npm run db:generate

# Check client generation
ls -la node_modules/.prisma/
```

#### Permission Errors

```sql
-- Check user permissions
SHOW GRANTS FOR 'sarav2_business'@'%';
SHOW GRANTS FOR 'sarav2_app'@'%';
```

### Getting Help

If you encounter issues:

1. Run the isolation test: `npm run test-db-isolation`
2. Check the logs for specific error messages
3. Verify database permissions and connectivity
4. Ensure environment variables are correctly set

## 📊 Monitoring

### Database Health Checks

The application includes built-in health checks:

- **Connection monitoring** for both databases
- **Read-only enforcement** on business database
- **Error logging** for database issues
- **Performance monitoring** for query execution

### Production Monitoring

Monitor these metrics in production:

- Database connection pool usage
- Query performance on both databases
- Error rates for database operations
- Business database read-only compliance

## 🎯 Next Steps

After completing the database setup:

1. **Deploy to staging** environment first
2. **Test all functionality** with the new databases
3. **Verify data integrity** and performance
4. **Deploy to production** when ready
5. **Monitor** database performance and security

---

## 📞 Support

For additional help with database setup:

- Check the troubleshooting section above
- Review the Prisma documentation
- Test with the provided isolation script
- Contact your database administrator for permission issues

**Remember**: This setup ensures complete isolation from your existing production database, protecting your current data while enabling SARA v2 development and deployment.
