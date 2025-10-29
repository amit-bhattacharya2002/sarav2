#!/usr/bin/env node

/**
 * SQL Server Connection Test for SARA v2
 * 
 * This script tests the SQL Server connection format and provides
 * detailed error information to help troubleshoot connection issues.
 */

const { PrismaClient } = require('@prisma/client')

async function testSQLServerConnection() {
  console.log('🔍 Testing SQL Server Connection for SARA v2...\n')

  // Test 1: Check if environment variable is set
  console.log('1️⃣  Checking Environment Variables:')
  const databaseUrl = process.env.SARAV2_DATABASE_URL
  
  if (!databaseUrl) {
    console.log('❌ SARAV2_DATABASE_URL is not set')
    console.log('💡 Set it with: export SARAV2_DATABASE_URL="your_connection_string"')
    return false
  }
  
  console.log('✅ SARAV2_DATABASE_URL is set')
  console.log(`   Connection string format: ${databaseUrl.split(';')[0]}...`)
  
  // Test 2: Parse connection string
  console.log('\n2️⃣  Parsing Connection String:')
  try {
    // Prisma uses a different format than standard URLs
    if (databaseUrl.startsWith('sqlserver://')) {
      console.log('✅ Prisma SQL Server format detected')
      const parts = databaseUrl.split(';')
      console.log(`   Server: ${parts[0].replace('sqlserver://', '')}`)
      
      parts.forEach(part => {
        if (part.includes('=')) {
          const [key, value] = part.split('=')
          if (key === 'user' || key === 'password') {
            console.log(`   ${key}: ${value.substring(0, 3)}...`)
          } else {
            console.log(`   ${key}: ${value}`)
          }
        }
      })
    } else {
      console.log('❌ Invalid format - should start with sqlserver://')
      return false
    }
  } catch (error) {
    console.log('❌ Error parsing connection string:', error.message)
    return false
  }
  
  // Test 3: Test Prisma connection
  console.log('\n3️⃣  Testing Prisma Connection:')
  try {
    const prisma = new PrismaClient({
      datasources: {
        db: {
          url: databaseUrl
        }
      },
      log: ['error', 'warn', 'info']
    })
    
    console.log('   Attempting to connect...')
    await prisma.$connect()
    console.log('✅ Prisma connection successful!')
    
    // Test a simple query
    console.log('   Testing basic query...')
    const result = await prisma.$queryRaw`SELECT 1 as test`
    console.log('✅ Basic query successful:', result)
    
    await prisma.$disconnect()
    console.log('✅ Connection closed successfully')
    
  } catch (error) {
    console.log('❌ Prisma connection failed:')
    console.log(`   Error: ${error.message}`)
    
    // Provide specific troubleshooting based on error
    if (error.message.includes('Authentication failed')) {
      console.log('\n🔧 Authentication Troubleshooting:')
      console.log('   - Verify your username and password are correct')
      console.log('   - Check if Active Directory authentication is properly configured')
      console.log('   - Ensure your account has access to the database')
    } else if (error.message.includes('Cannot connect')) {
      console.log('\n🔧 Connection Troubleshooting:')
      console.log('   - Verify the server name and port are correct')
      console.log('   - Check if the server is accessible from your network')
      console.log('   - Ensure firewall allows connections on port 1433')
    } else if (error.message.includes('Database')) {
      console.log('\n🔧 Database Troubleshooting:')
      console.log('   - Verify the database name is correct')
      console.log('   - Check if the database exists')
      console.log('   - Ensure your user has access to this database')
    }
    
    return false
  }
  
  console.log('\n🎉 SQL Server connection test completed successfully!')
  console.log('\n📋 Summary:')
  console.log('   ✅ Connection string format is correct')
  console.log('   ✅ Prisma can connect to SQL Server')
  console.log('   ✅ Basic queries work')
  console.log('   ✅ Ready for SARA v2 deployment')
  
  return true
}

// Run the test
if (require.main === module) {
  testSQLServerConnection()
    .then(success => {
      process.exit(success ? 0 : 1)
    })
    .catch(error => {
      console.error('❌ Test failed with error:', error)
      process.exit(1)
    })
}

module.exports = { testSQLServerConnection }
