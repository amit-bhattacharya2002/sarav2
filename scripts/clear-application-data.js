#!/usr/bin/env node

/**
 * Clear Application Data Script for SARA v2
 * 
 * This script clears old saved queries and dashboards to start fresh
 * with the new health staff database.
 */

const { PrismaClient } = require('@prisma/client')

async function clearApplicationData() {
  console.log('🧹 Clearing old application data...\n')

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

    // Count existing data
    const queryCount = await prisma.savedQuery.count()
    const dashboardCount = await prisma.savedDashboard.count()
    
    console.log(`📊 Current Application Data:`)
    console.log(`   Saved Queries: ${queryCount}`)
    console.log(`   Saved Dashboards: ${dashboardCount}`)
    
    if (queryCount === 0 && dashboardCount === 0) {
      console.log('\n✅ No application data to clear - database is already clean!')
      await prisma.$disconnect()
      return
    }

    // Clear saved queries
    if (queryCount > 0) {
      console.log(`\n🗑️  Clearing ${queryCount} saved queries...`)
      await prisma.savedQuery.deleteMany({})
      console.log('✅ Saved queries cleared')
    }

    // Clear saved dashboards
    if (dashboardCount > 0) {
      console.log(`\n🗑️  Clearing ${dashboardCount} saved dashboards...`)
      await prisma.savedDashboard.deleteMany({})
      console.log('✅ Saved dashboards cleared')
    }

    // Verify cleanup
    const finalQueryCount = await prisma.savedQuery.count()
    const finalDashboardCount = await prisma.savedDashboard.count()
    
    console.log('\n📊 Final Application Data:')
    console.log(`   Saved Queries: ${finalQueryCount}`)
    console.log(`   Saved Dashboards: ${finalDashboardCount}`)
    
    // Show health staff data (should remain untouched)
    const staffCount = await prisma.healthstaff_schedule.count()
    console.log(`   Health Staff Records: ${staffCount} (preserved)`)

    await prisma.$disconnect()
    console.log('\n🎉 Application data cleared successfully!')
    console.log('💡 You can now start fresh with health staff analytics')
    
  } catch (error) {
    console.error('❌ Failed to clear application data:', error.message)
    process.exit(1)
  }
}

// Run the cleanup
if (require.main === module) {
  clearApplicationData()
    .then(() => {
      process.exit(0)
    })
    .catch(error => {
      console.error('❌ Cleanup failed:', error)
      process.exit(1)
    })
}

module.exports = { clearApplicationData }
