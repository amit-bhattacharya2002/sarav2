#!/usr/bin/env node

const mysql = require('mysql2/promise');

console.log('🔍 Testing database connection...');

async function testConnection() {
  try {
    // Parse the database URL from environment or use a test URL
    const dbUrl = process.env.BUSINESS_DATABASE_URL;
    console.log('📋 Database URL:', dbUrl ? 'Set' : 'Not set');
    
    if (!dbUrl) {
      console.error('❌ BUSINESS_DATABASE_URL is not set');
      console.log('\n🔧 To test your connection, set the environment variable:');
      console.log('export BUSINESS_DATABASE_URL="mysql://username:password@hostname:3306/database_name?ssl=true"');
      console.log('Then run: npm run test-db');
      return;
    }

    // Create connection
    const connection = await mysql.createConnection(dbUrl);
    console.log('✅ Database connection successful!');
    
    // Test a simple query
    const [rows] = await connection.execute('SELECT 1 as test');
    console.log('✅ Query test successful:', rows);
    
    // Test if the saved_queries table exists
    try {
      const [tables] = await connection.execute('SHOW TABLES LIKE "saved_queries"');
      console.log('📋 saved_queries table exists:', tables.length > 0);
      
      if (tables.length > 0) {
        const [queryCount] = await connection.execute('SELECT COUNT(*) as count FROM saved_queries');
        console.log('📊 Number of saved queries:', queryCount[0].count);
      }
    } catch (tableError) {
      console.log('⚠️  saved_queries table not found or not accessible');
    }
    
    await connection.end();
    console.log('✅ Connection closed successfully');
    
  } catch (error) {
    console.error('❌ Database connection failed:');
    console.error('Error code:', error.code);
    console.error('Error message:', error.message);
    
    // Provide specific Hostinger troubleshooting tips
    console.log('\n🔧 Hostinger Troubleshooting Tips:');
    console.log('1. Check if your database hostname is correct');
    console.log('2. Verify username and password');
    console.log('3. Ensure database name is correct');
    console.log('4. Check if SSL is required (add ?ssl=true)');
    console.log('5. Verify your IP is whitelisted in Hostinger');
    console.log('6. Check if the database user has proper permissions');
    console.log('\n📋 Common Hostinger database URL format:');
    console.log('mysql://username:password@mysql.hostinger.com:3306/database_name?ssl=true');
  }
}

testConnection(); 