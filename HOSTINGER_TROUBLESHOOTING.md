# Hostinger MySQL Connection Troubleshooting

## Common Hostinger MySQL Issues

### 1. **Database URL Format**

**Correct format for Hostinger:**

```bash
BUSINESS_DATABASE_URL="mysql://username:password@hostname:3306/database_name?ssl=true"
```

**Common issues:**

- Missing port number (3306)
- Missing SSL parameter
- Incorrect hostname
- Special characters in password not URL-encoded

### 2. **Hostinger Database Settings**

**Check these in your Hostinger control panel:**

1. **Database Hostname**: Usually `mysql.hostinger.com` or similar
2. **Port**: Usually `3306`
3. **Database Name**: Your specific database name
4. **Username**: Database username (not hosting account username)
5. **Password**: Database password

### 3. **SSL Configuration**

**Add SSL parameter to your connection string:**

```bash
BUSINESS_DATABASE_URL="mysql://username:password@hostname:3306/database_name?ssl=true"
```

### 4. **IP Whitelisting**

**In Hostinger control panel:**

1. Go to "Databases" → "MySQL Databases"
2. Find your database
3. Check "Remote Access" settings
4. Add your IP or use `%` for all IPs (less secure)

### 5. **Database User Permissions**

**Ensure your database user has:**

- `SELECT` permissions on all tables
- `INSERT`, `UPDATE`, `DELETE` on `saved_queries` and `saved_dashboards`
- `CREATE` permissions if tables don't exist

### 6. **Test Your Connection**

Run the database test script:

```bash
npm run test-db
```

This will help identify specific connection issues.

## Step-by-Step Troubleshooting

### **Step 1: Verify Database Credentials**

1. **Log into Hostinger control panel**
2. **Go to "Databases" → "MySQL Databases"**
3. **Note down:**
   - Database hostname
   - Database name
   - Username
   - Password
   - Port (usually 3306)

### **Step 2: Test Connection Locally**

Create a `.env` file with your database URL:

```bash
BUSINESS_DATABASE_URL="mysql://username:password@hostname:3306/database_name?ssl=true"
```

Then run:

```bash
npm run test-db
```

### **Step 3: Check for Common Issues**

**If connection fails, check:**

1. **Password with special characters**: URL-encode them

   ```bash
   # If password is "my@password"
   BUSINESS_DATABASE_URL="mysql://username:my%40password@hostname:3306/database_name?ssl=true"
   ```

2. **Hostname**: Use the full hostname from Hostinger

   ```bash
   # Usually something like:
   BUSINESS_DATABASE_URL="mysql://username:password@mysql.hostinger.com:3306/database_name?ssl=true"
   ```

3. **SSL**: Try with and without SSL

   ```bash
   # With SSL
   BUSINESS_DATABASE_URL="mysql://username:password@hostname:3306/database_name?ssl=true"

   # Without SSL (if SSL fails)
   BUSINESS_DATABASE_URL="mysql://username:password@hostname:3306/database_name"
   ```

### **Step 4: Check Database Tables**

**Ensure these tables exist:**

- `saved_queries`
- `saved_dashboards`
- `gifts` (if using business data)

**If tables don't exist, create them:**

```sql
CREATE TABLE saved_queries (
    id INT AUTO_INCREMENT PRIMARY KEY,
    userId INT DEFAULT 1,
    companyId INT DEFAULT 1,
    title VARCHAR(255),
    queryText TEXT,
    sqlText TEXT,
    outputMode INT DEFAULT 1,
    visualConfig TEXT,
    panelPosition VARCHAR(100),
    resultData LONGTEXT,
    resultColumns TEXT,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE saved_dashboards (
    id INT AUTO_INCREMENT PRIMARY KEY,
    userId INT DEFAULT 1,
    companyId INT DEFAULT 1,
    title VARCHAR(255),
    quadrants TEXT,
    visualizations TEXT,
    sVisualizations TEXT,
    topLeftTitle VARCHAR(255) DEFAULT 'Sample Title',
    topRightTitle VARCHAR(255) DEFAULT 'Sample Title',
    bottomTitle VARCHAR(255) DEFAULT 'Sample Title',
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### **Step 5: Vercel Environment Variables**

**In Vercel dashboard, set:**

```bash
BUSINESS_DATABASE_URL="mysql://username:password@hostname:3306/database_name?ssl=true"
AUTH_DATABASE_URL="mysql://username:password@hostname:3306/auth_database_name?ssl=true"
```

## Common Error Messages & Solutions

### **"Access denied for user"**

- Check username and password
- Verify database name
- Check if user has proper permissions

### **"Can't connect to MySQL server"**

- Check hostname and port
- Verify IP whitelisting
- Check if database server is running

### **"Unknown database"**

- Verify database name exists
- Check if user has access to that database

### **"SSL connection required"**

- Add `?ssl=true` to your connection string
- Or contact Hostinger support for SSL settings

## Testing Commands

### **Test Database Connection:**

```bash
npm run test-db
```

### **Test Prisma Connection:**

```bash
npx prisma db pull --schema=prisma/business-schema.prisma
```

### **Generate Prisma Client:**

```bash
npm run db:generate
```

## Contact Hostinger Support

If issues persist, contact Hostinger support with:

1. Your database hostname
2. Error messages
3. Connection attempts from your IP
4. Request for MySQL connection troubleshooting

## Alternative Solutions

### **1. Use Hostinger's phpMyAdmin**

- Access via Hostinger control panel
- Verify database structure
- Test queries directly

### **2. Check Hostinger's MySQL Version**

- Ensure compatibility with Prisma
- Some older MySQL versions may have issues

### **3. Use Connection Pooling**

- Add connection pooling parameters to URL
- Helps with connection stability

```bash
BUSINESS_DATABASE_URL="mysql://username:password@hostname:3306/database_name?ssl=true&connection_limit=5&pool_timeout=2"
```
