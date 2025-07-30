// Simple test script to verify MongoDB queries work
const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function testQueries() {
  console.log('🧪 Testing MongoDB queries...')

  try {
    // Test 1: Count constituents
    const constituentCount = await prisma.constituent.count()
    console.log(`✅ Found ${constituentCount} constituents`)

    // Test 2: Count gifts
    const giftCount = await prisma.gift.count()
    console.log(`✅ Found ${giftCount} gifts`)

    // Test 3: Get all gifts with amounts
    const gifts = await prisma.gift.findMany({
      select: {
        giftId: true,
        giftAmount: true,
        designation: true,
        sourceCode: true,
      },
      take: 3
    })
    console.log('✅ Sample gifts:', gifts)

    // Test 4: Test aggregation pipeline
    const aggregationResult = await prisma.$runCommandRaw({
      aggregate: 'gifts',
      pipeline: [
        {
          $group: {
            _id: '$designation',
            totalAmount: { $sum: { $toDouble: '$giftAmount' } },
            count: { $sum: 1 }
          }
        },
        { $sort: { totalAmount: -1 } }
      ],
      cursor: {}
    })

    const results = aggregationResult.cursor?.firstBatch || []
    console.log('✅ Aggregation test results:', results)

    console.log('🎉 All tests passed!')
  } catch (error) {
    console.error('❌ Test failed:', error)
  } finally {
    await prisma.$disconnect()
  }
}

testQueries() 