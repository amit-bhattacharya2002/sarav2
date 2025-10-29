#!/usr/bin/env node

/**
 * Database Inspection Script for SARA v2
 * 
 * This script inspects the existing database structure to understand
 * what tables and data already exist, so we can modify the schema accordingly.
 */

const { PrismaClient } = require('@prisma/client')

async function inspectDatabase() {
  console.log('🔍 Inspecting existing database structure...\n')

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

    // Get all tables
    console.log('📋 Existing Tables:')
    const tables = await prisma.$queryRaw`
      SELECT TABLE_NAME, TABLE_TYPE 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_TYPE = 'BASE TABLE'
      ORDER BY TABLE_NAME
    `
    
    console.log(`Found ${tables.length} tables:`)
    tables.forEach((table, index) => {
      console.log(`   ${index + 1}. ${table.TABLE_NAME}`)
    })

    // Get table schemas
    console.log('\n📊 Table Schemas:')
    for (const table of tables) {
      console.log(`\n--- ${table.TABLE_NAME} ---`)
      
      // Get column information
      const columns = await prisma.$queryRaw`
        SELECT 
          COLUMN_NAME,
          DATA_TYPE,
          IS_NULLABLE,
          CHARACTER_MAXIMUM_LENGTH,
          COLUMN_DEFAULT
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_NAME = ${table.TABLE_NAME}
        ORDER BY ORDINAL_POSITION
      `
      
      columns.forEach(col => {
        const length = col.CHARACTER_MAXIMUM_LENGTH ? `(${col.CHARACTER_MAXIMUM_LENGTH})` : ''
        const nullable = col.IS_NULLABLE === 'YES' ? 'NULL' : 'NOT NULL'
        const defaultVal = col.COLUMN_DEFAULT ? ` DEFAULT ${col.COLUMN_DEFAULT}` : ''
        console.log(`   ${col.COLUMN_NAME}: ${col.DATA_TYPE}${length} ${nullable}${defaultVal}`)
      })

      // Get row count
      try {
        const countResult = await prisma.$queryRaw`SELECT COUNT(*) as count FROM ${prisma.$queryRaw`${table.TABLE_NAME}`}`
        console.log(`   Rows: ${countResult[0].count}`)
      } catch (error) {
        console.log(`   Rows: Unable to count (${error.message})`)
      }
    }

    // Check for existing indexes
    console.log('\n🔍 Existing Indexes:')
    const indexes = await prisma.$queryRaw`
      SELECT 
        t.name AS table_name,
        i.name AS index_name,
        i.type_desc AS index_type,
        c.name AS column_name
      FROM sys.tables t
      INNER JOIN sys.indexes i ON t.object_id = i.object_id
      INNER JOIN sys.index_columns ic ON i.object_id = ic.object_id AND i.index_id = ic.index_id
      INNER JOIN sys.columns c ON ic.object_id = c.object_id AND ic.column_id = c.column_id
      WHERE i.index_id > 0
      ORDER BY t.name, i.name
    `
    
    if (indexes.length > 0) {
      indexes.forEach(index => {
        console.log(`   ${index.table_name}.${index.column_name} -> ${index.index_name} (${index.index_type})`)
      })
    } else {
      console.log('   No indexes found')
    }

    await prisma.$disconnect()
    console.log('\n✅ Database inspection completed successfully!')
    
  } catch (error) {
    console.error('❌ Database inspection failed:', error.message)
    process.exit(1)
  }
}

// Run the inspection
if (require.main === module) {
  inspectDatabase()
    .then(() => {
      process.exit(0)
    })
    .catch(error => {
      console.error('❌ Inspection failed:', error)
      process.exit(1)
    })
}

module.exports = { inspectDatabase }
