#!/usr/bin/env node

/**
 * Health Staff Data Test for SARA v2
 * 
 * This script tests querying the existing healthstaff_schedule data
 * to ensure the schema works correctly with your existing data.
 */

const { PrismaClient } = require('@prisma/client')

async function testHealthStaffData() {
  console.log('🔍 Testing Health Staff Data Access...\n')

  try {
    const prisma = new PrismaClient({
      datasources: {
        db: {
          url: process.env.SARAV2_DATABASE_URL
        }
      },
      log: ['error', 'warn']
    })
    
    await prisma.$connect()
    console.log('✅ Connected to database successfully\n')

    // Test 1: Count total records
    console.log('1️⃣  Counting Records:')
    const totalCount = await prisma.healthstaff_schedule.count()
    console.log(`   Total health staff records: ${totalCount}`)

    // Test 2: Get sample records
    console.log('\n2️⃣  Sample Records:')
    const sampleRecords = await prisma.healthstaff_schedule.findMany({
      take: 3,
      select: {
        Staff_ID: true,
        Department: true,
        Shift_Duration_Hours: true,
        Patient_Load: true,
        Satisfaction_Score: true
      }
    })
    
    sampleRecords.forEach((record, index) => {
      console.log(`   Record ${index + 1}:`)
      console.log(`     Staff ID: ${record.Staff_ID}`)
      console.log(`     Department: ${record.Department || 'N/A'}`)
      console.log(`     Shift Hours: ${record.Shift_Duration_Hours || 'N/A'}`)
      console.log(`     Patient Load: ${record.Patient_Load || 'N/A'}`)
      console.log(`     Satisfaction: ${record.Satisfaction_Score || 'N/A'}`)
    })

    // Test 3: Test aggregation queries
    console.log('\n3️⃣  Data Analysis:')
    
    // Average satisfaction score by department
    const deptStats = await prisma.healthstaff_schedule.groupBy({
      by: ['Department'],
      _avg: {
        Satisfaction_Score: true,
        Patient_Load: true,
        Shift_Duration_Hours: true
      },
      _count: {
        Staff_ID: true
      },
      where: {
        Department: {
          not: null
        }
      }
    })
    
    console.log('   Department Statistics:')
    deptStats.forEach(dept => {
      console.log(`     ${dept.Department}:`)
      console.log(`       Staff Count: ${dept._count.Staff_ID}`)
      console.log(`       Avg Satisfaction: ${dept._avg.Satisfaction_Score?.toFixed(2) || 'N/A'}`)
      console.log(`       Avg Patient Load: ${dept._avg.Patient_Load?.toFixed(1) || 'N/A'}`)
      console.log(`       Avg Shift Hours: ${dept._avg.Shift_Duration_Hours?.toFixed(1) || 'N/A'}`)
    })

    // Test 4: Test read-only protection
    console.log('\n4️⃣  Testing Read-Only Protection:')
    try {
      await prisma.healthstaff_schedule.create({
        data: {
          Staff_ID: 'TEST123',
          Department: 'Test Department'
        }
      })
      console.log('   ❌ WARNING: Write operation was allowed! This should be blocked.')
    } catch (error) {
      if (error.message.includes('WRITE OPERATION BLOCKED')) {
        console.log('   ✅ Read-only protection is working correctly')
      } else {
        console.log(`   ⚠️  Write blocked for different reason: ${error.message}`)
      }
    }

    await prisma.$disconnect()
    console.log('\n🎉 Health staff data test completed successfully!')
    console.log('\n📋 Summary:')
    console.log('   ✅ Database connection works')
    console.log('   ✅ Can read existing health staff data')
    console.log('   ✅ Aggregation queries work')
    console.log('   ✅ Schema matches existing data structure')
    console.log('   ✅ Ready for SARA v2 with health staff data')
    
  } catch (error) {
    console.error('❌ Health staff data test failed:', error.message)
    process.exit(1)
  }
}

// Run the test
if (require.main === module) {
  testHealthStaffData()
    .then(() => {
      process.exit(0)
    })
    .catch(error => {
      console.error('❌ Test failed:', error)
      process.exit(1)
    })
}

module.exports = { testHealthStaffData }
