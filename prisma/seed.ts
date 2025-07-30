import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Starting database seed...')

  // Clear existing data
  await prisma.address.deleteMany()
  await prisma.constituent.deleteMany()
  await prisma.gift.deleteMany()
  await prisma.schemaDefinition.deleteMany()

  // Create sample constituents
  const constituent1 = await prisma.constituent.create({
    data: {
      constituentId: 'a09047a3-97dc-43f5-8afa-33155c085232',
      firstName: 'John',
      lastName: 'Doe',
      email: 'john.doe@example.com',
      phone: '604-555-0101',
      isActive: true,
      dateAdded: new Date('2025-04-03'),
      dateChanged: new Date('2025-04-03'),
    },
  })

  const constituent2 = await prisma.constituent.create({
    data: {
      constituentId: 'adcfcb8e-f670-4e54-af34-9756c852b211',
      firstName: 'Jane',
      lastName: 'Smith',
      email: 'jane.smith@example.com',
      phone: '604-555-0102',
      isActive: true,
      dateAdded: new Date('2025-04-03'),
      dateChanged: new Date('2025-04-03'),
    },
  })

  const constituent3 = await prisma.constituent.create({
    data: {
      constituentId: 'c455feb9-00e0-436b-bee8-d5eeac4ad85c',
      firstName: 'Bob',
      lastName: 'Johnson',
      email: 'bob.johnson@example.com',
      phone: '604-555-0103',
      isActive: true,
      dateAdded: new Date('2025-04-03'),
      dateChanged: new Date('2025-04-03'),
    },
  })

  // Create sample addresses
  await prisma.address.createMany({
    data: [
      {
        addressId: '1b270d12-5dd5-48e3-8e3c-fd91afdcf040',
        isPrimary: true,
        doNotMail: false,
        startDate: '0101',
        endDate: '1231',
        addressBlock: '859 Main St',
        city: 'Maple Ridge',
        postCode: 'V2X2X2',
        cart: '',
        dpc: '',
        lot: '',
        sequence: '9',
        dateAdded: new Date('2025-04-03 18:24:08'),
        dateChanged: new Date('2025-04-03 18:24:08'),
        ts: new Date('2025-04-03 18:24:08'),
        isConfidential: false,
        constituentId: constituent1.constituentId,
        countryId: 'CA',
      },
      {
        addressId: '21e01c43-6eb7-435a-876a-5a1c1db3a276',
        isPrimary: true,
        doNotMail: false,
        startDate: '0101',
        endDate: '1231',
        addressBlock: '130 Main St',
        city: 'Richmond',
        postCode: 'V6X3Z9',
        cart: '',
        dpc: '',
        lot: '',
        sequence: '4',
        dateAdded: new Date('2025-04-03 18:24:08'),
        dateChanged: new Date('2025-04-03 18:24:08'),
        ts: new Date('2025-04-03 18:24:08'),
        isConfidential: false,
        constituentId: constituent2.constituentId,
        countryId: 'CA',
      },
      {
        addressId: '4558b56d-9548-468a-8e64-4a61811678ac',
        isPrimary: true,
        doNotMail: false,
        startDate: '0101',
        endDate: '1231',
        addressBlock: '806 Main St',
        city: 'North Vancouver',
        postCode: 'V7P3T4',
        cart: '',
        dpc: '',
        lot: '',
        sequence: '10',
        dateAdded: new Date('2025-04-03 18:24:08'),
        dateChanged: new Date('2025-04-03 18:24:08'),
        ts: new Date('2025-04-03 18:24:08'),
        isConfidential: false,
        constituentId: constituent3.constituentId,
        countryId: 'CA',
      },
    ],
  })

  // Create sample gifts
  await prisma.gift.createMany({
    data: [
      {
        giftId: 'gift-001',
        giftDate: new Date('2025-01-15'),
        giftAmount: '500.00',
        transactionType: 'Gift',
        giftType: 'Single',
        paymentMethod: 'Credit Card',
        softCreditIndicator: 'N',
        softCreditAmount: '0.00',
        sourceCode: 'Web Gift',
        designation: 'Student Bursaries Fund',
        unit: 'UA - University Advancement',
        purposeCategory: 'Operating',
        appeal: 'AALGEN871',
        givingLevel: '$500-$999.99',
        constituentId: constituent1.constituentId,
        dateAdded: new Date('2025-01-15'),
        dateChanged: new Date('2025-01-15'),
      },
      {
        giftId: 'gift-002',
        giftDate: new Date('2025-02-20'),
        giftAmount: '1000.00',
        transactionType: 'Gift',
        giftType: 'Single',
        paymentMethod: 'Check',
        softCreditIndicator: 'N',
        softCreditAmount: '0.00',
        sourceCode: 'Direct Mail',
        designation: '88 Keys Campaign',
        unit: 'UA - University Advancement',
        purposeCategory: 'Capital Project',
        appeal: 'CUAGENXX',
        givingLevel: '$1,000+',
        constituentId: constituent2.constituentId,
        dateAdded: new Date('2025-02-20'),
        dateChanged: new Date('2025-02-20'),
      },
      {
        giftId: 'gift-003',
        giftDate: new Date('2025-03-10'),
        giftAmount: '250.00',
        transactionType: 'Gift',
        giftType: 'Recurring',
        paymentMethod: 'Credit Card',
        softCreditIndicator: 'N',
        softCreditAmount: '0.00',
        sourceCode: 'Email',
        designation: 'Engineering Equipment Endowment',
        unit: 'UA - University Advancement',
        purposeCategory: 'Endowment',
        appeal: 'AALGEN881',
        givingLevel: '$100-$499.99',
        constituentId: constituent3.constituentId,
        dateAdded: new Date('2025-03-10'),
        dateChanged: new Date('2025-03-10'),
      },
      {
        giftId: 'gift-004',
        giftDate: new Date('2025-01-30'),
        giftAmount: '750.00',
        transactionType: 'Gift',
        giftType: 'Single',
        paymentMethod: 'Credit Card',
        softCreditIndicator: 'N',
        softCreditAmount: '0.00',
        sourceCode: 'Phone Call',
        designation: 'Student Bursaries Fund',
        unit: 'UA - University Advancement',
        purposeCategory: 'Operating',
        appeal: 'AALGEN871',
        givingLevel: '$500-$999.99',
        constituentId: constituent1.constituentId,
        dateAdded: new Date('2025-01-30'),
        dateChanged: new Date('2025-01-30'),
      },
      {
        giftId: 'gift-005',
        giftDate: new Date('2025-02-15'),
        giftAmount: '1500.00',
        transactionType: 'Gift',
        giftType: 'Single',
        paymentMethod: 'Check',
        softCreditIndicator: 'N',
        softCreditAmount: '0.00',
        sourceCode: 'Personal Solicitation',
        designation: '88 Keys Campaign',
        unit: 'UA - University Advancement',
        purposeCategory: 'Capital Project',
        appeal: 'CUAGENXX',
        givingLevel: '$1,000+',
        constituentId: constituent2.constituentId,
        dateAdded: new Date('2025-02-15'),
        dateChanged: new Date('2025-02-15'),
      },
    ],
  })

  // Create schema definition for AI queries
  await prisma.schemaDefinition.create({
    data: {
      schemaText: `
Database Schema for Constituent Management System:

Collections:
1. constituents
   - constituentId (String): Unique identifier for the constituent
   - firstName (String): First name of the constituent
   - lastName (String): Last name of the constituent
   - email (String): Email address
   - phone (String): Phone number
   - dateOfBirth (DateTime): Date of birth
   - isActive (Boolean): Whether the constituent is active
   - dateAdded (DateTime): When the record was added
   - dateChanged (DateTime): When the record was last changed

2. addresses
   - addressId (String): Unique identifier for the address
   - constituentId (String): Reference to constituent
   - isPrimary (Boolean): Whether this is the primary address
   - doNotMail (Boolean): Whether to exclude from mailings
   - addressBlock (String): Street address
   - city (String): City name
   - postCode (String): Postal code
   - countryId (String): Country code
   - dateAdded (DateTime): When the record was added
   - dateChanged (DateTime): When the record was last changed

3. gifts
   - giftId (String): Unique identifier for the gift
   - constituentId (String): Reference to constituent
   - giftDate (DateTime): Date of the gift
   - giftAmount (String): Amount of the gift (stored as string)
   - transactionType (String): Type of transaction (e.g., "Gift", "Pledge")
   - giftType (String): Type of gift (e.g., "Single", "Recurring")
   - paymentMethod (String): Payment method (e.g., "Credit Card", "Check")
   - sourceCode (String): Campaign or appeal source code
   - designation (String): Specific fund or initiative
   - unit (String): Organizational department
   - purposeCategory (String): Classification of gift intent
   - appeal (String): Specific fundraising effort
   - givingLevel (String): Dollar tier of the gift
   - dateAdded (DateTime): When the record was added
   - dateChanged (DateTime): When the record was last changed

IMPORTANT: Keep queries simple. Focus on single collection queries. Avoid complex $lookup operations for now.

For date filtering, use simple date ranges. For amount calculations, use $toDouble to convert string amounts to numbers.

Sample gift dates in database: 2025-01-15, 2025-02-20, 2025-03-10, 2025-01-30, 2025-02-15

Common source codes include: Phone Call, Direct Mail, Personal Solicitation, Web Gift, Event, Email, Coffee Club, Faculty Newsletter, Athletics, United Way, Telemarketing, Proposal, Sponsorship.

Common designations include: "88 Keys Campaign", "Student Bursaries Fund", "Engineering Equipment Endowment".

Common units include: "UA - University Advancement".

Common purpose categories include: "Endowment", "Operating", "Capital Project".

Common giving levels include: "$1-$99.99", "$100-$499.99", "$500-$999.99", "$1,000+".

Example simple queries:
- Group gifts by designation and sum amounts using $toDouble
- Count gifts by payment method
- Show top gifts by amount using $toDouble
- Filter gifts by source code
- Sum total donations by constituent
- Count gifts by payment method
      `,
    },
  })

  console.log('✅ Database seeded successfully!')
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  }) 