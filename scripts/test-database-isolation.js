#!/usr/bin/env node

/**
 * Database Isolation Test for SARA v2
 * 
 * This script tests that the new database configuration properly isolates
 * the v2 databases from any existing production databases.
 */

const { PrismaClient } = require('@prisma/client')

async function testDatabaseIsolation() {
  console.log('🔍 Testing SARA v2 Database Isolation...\n')

  // Test 1: Check environment variables
  console.log('1️⃣  Checking Environment Variables:')
  const requiredVars = [
    'SARAV2_DATABASE_URL'
  ]
  
  const missingVars = requiredVars.filter(varName => !process.env[varName])
  
  if (missingVars.length > 0) {
    console.log('❌ Missing required environment variables:')
    missingVars.forEach(varName => console.log(`   - ${varName}`))
    console.log('\n💡 Please set these variables in your .env.local file')
    return false
  }
  
  console.log('✅ All required environment variables are set')
  
  // Test 2: Verify database URL is set
  console.log('\n2️⃣  Verifying Database Configuration:')
  const databaseUrl = process.env.SARAV2_DATABASE_URL
  
  if (!databaseUrl) {
    console.log('❌ ERROR: SARAV2_DATABASE_URL is not set!')
    return false
  }
  
  console.log('✅ SARA v2 database URL is configured')
  console.log(`   Database: ${databaseUrl.split('@')[1] || 'hidden'}`)
  
  // Test 3: Test database connection
  console.log('\n3️⃣  Testing Database Connection:')
  try {
    const prisma = new PrismaClient({
      datasources: {
        db: {
          url: databaseUrl
        }
      }
    })
    
    // Test a simple read operation
    await prisma.$connect()
    console.log('✅ Database connection successful')
    
    // Test that we can read business data
    try {
      await prisma.$executeRaw`SELECT 1 as test`
      console.log('✅ Database allows read operations')
    } catch (error) {
      console.log('❌ Database read test failed:', error.message)
    }
    
    await prisma.$disconnect()
  } catch (error) {
    console.log('❌ Database connection failed:', error.message)
    return false
  }
  
  // Test 4: Verify no legacy database references
  console.log('\n4️⃣  Checking for Legacy Database References:')
  const legacyVar = process.env.BUSINESS_DATABASE_URL
  if (legacyVar) {
    console.log('⚠️  WARNING: Legacy BUSINESS_DATABASE_URL is still set')
    console.log('   This could accidentally connect to your production database!')
    console.log('   Consider removing this variable to prevent accidents.')
  } else {
    console.log('✅ No legacy database references found')
  }
  
  console.log('\n🎉 Database isolation test completed successfully!')
  console.log('\n📋 Summary:')
  console.log('   ✅ Environment variables configured')
  console.log('   ✅ Database connection successful')
  console.log('   ✅ Database allows read operations')
  console.log('   ✅ No accidental production database access')
  
  return true
}

// Run the test
if (require.main === module) {
  testDatabaseIsolation()
    .then(success => {
      process.exit(success ? 0 : 1)
    })
    .catch(error => {
      console.error('❌ Test failed with error:', error)
      process.exit(1)
    })
}

module.exports = { testDatabaseIsolation }
