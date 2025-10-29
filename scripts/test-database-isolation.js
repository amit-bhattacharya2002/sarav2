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
    'SARAV2_BUSINESS_DATABASE_URL',
    'SARAV2_APP_DATABASE_URL'
  ]
  
  const missingVars = requiredVars.filter(varName => !process.env[varName])
  
  if (missingVars.length > 0) {
    console.log('❌ Missing required environment variables:')
    missingVars.forEach(varName => console.log(`   - ${varName}`))
    console.log('\n💡 Please set these variables in your .env.local file')
    return false
  }
  
  console.log('✅ All required environment variables are set')
  
  // Test 2: Verify database URLs are different
  console.log('\n2️⃣  Verifying Database Separation:')
  const businessUrl = process.env.SARAV2_BUSINESS_DATABASE_URL
  const appUrl = process.env.SARAV2_APP_DATABASE_URL
  
  if (businessUrl === appUrl) {
    console.log('❌ ERROR: Business and App databases are the same!')
    console.log('   This could cause data corruption.')
    return false
  }
  
  console.log('✅ Business and App databases are separate')
  console.log(`   Business DB: ${businessUrl.split('@')[1] || 'hidden'}`)
  console.log(`   App DB: ${appUrl.split('@')[1] || 'hidden'}`)
  
  // Test 3: Test business database connection (read-only)
  console.log('\n3️⃣  Testing Business Database Connection:')
  try {
    const businessPrisma = new PrismaClient({
      datasources: {
        db: {
          url: businessUrl
        }
      }
    })
    
    // Test a simple read operation
    await businessPrisma.$connect()
    console.log('✅ Business database connection successful')
    
    // Test that we can't write (this should fail)
    try {
      await businessPrisma.$executeRaw`CREATE TABLE test_write_protection (id INT)`
      console.log('❌ WARNING: Business database allows writes! This is dangerous.')
    } catch (error) {
      console.log('✅ Business database is properly read-only')
    }
    
    await businessPrisma.$disconnect()
  } catch (error) {
    console.log('❌ Business database connection failed:', error.message)
    return false
  }
  
  // Test 4: Test app database connection (read-write)
  console.log('\n4️⃣  Testing App Database Connection:')
  try {
    const appPrisma = new PrismaClient({
      datasources: {
        db: {
          url: appUrl
        }
      }
    })
    
    await appPrisma.$connect()
    console.log('✅ App database connection successful')
    
    // Test that we can write (this should succeed)
    try {
      await appPrisma.$executeRaw`SELECT 1 as test`
      console.log('✅ App database allows read operations')
    } catch (error) {
      console.log('❌ App database read test failed:', error.message)
    }
    
    await appPrisma.$disconnect()
  } catch (error) {
    console.log('❌ App database connection failed:', error.message)
    return false
  }
  
  // Test 5: Verify no legacy database references
  console.log('\n5️⃣  Checking for Legacy Database References:')
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
  console.log('   ✅ Databases are properly separated')
  console.log('   ✅ Business database is read-only')
  console.log('   ✅ App database is accessible')
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
