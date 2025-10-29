import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Starting database seed...')

  // Clear existing data
  await prisma.savedDashboard.deleteMany()
  await prisma.savedQuery.deleteMany()

  // Create sample saved queries
  const sampleQuery = await prisma.savedQuery.create({
    data: {
      title: 'Sample Health Staff Query',
      queryText: 'Show me all health staff with their department and experience',
      sqlText: 'SELECT Staff_ID, Department, Years_of_Experience FROM healthstaff_schedule',
      outputMode: 1,
      visualConfig: '{"type": "table"}',
      panelPosition: 'top-left',
      resultColumns: '["Staff_ID", "Department", "Years_of_Experience"]',
      resultData: '[]',
      comboPrompt: 'Show health staff information',
      selectedColumns: '["Staff_ID", "Department", "Years_of_Experience"]',
      filteredColumns: '{}'
    }
  })

  // Create sample dashboard
  const sampleDashboard = await prisma.savedDashboard.create({
    data: {
      title: 'Health Staff Analytics Dashboard',
      quadrants: '{"topLeft": "Staff Overview", "topRight": "Department Analysis", "bottom": "Experience Distribution"}',
      visualizations: '{"topLeft": "table", "topRight": "pie", "bottom": "bar"}',
      sVisualizations: '{"topLeft": "table", "topRight": "pie", "bottom": "bar"}',
      topLeftTitle: 'Staff Overview',
      topRightTitle: 'Department Analysis',
      bottomTitle: 'Experience Distribution'
    }
  })

  console.log('✅ Database seeded successfully!')
  console.log('Created sample query:', sampleQuery.title)
  console.log('Created sample dashboard:', sampleDashboard.title)
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })