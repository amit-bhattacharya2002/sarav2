#!/usr/bin/env node

const path = require('path');
const fs = require('fs');

console.log('🔍 Debugging Prisma Vercel Deployment Issues...');
console.log('================================================');

// Check environment variables
console.log('\n📋 Environment Variables:');
console.log('🔍 Checking Prisma configuration...');
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('BUSINESS_DATABASE_URL:', process.env.BUSINESS_DATABASE_URL ? 'Set' : 'Not set');

// Check Prisma client locations
console.log('\n📁 Prisma Client Locations:');
const prismaPaths = [
  'node_modules/.prisma/client',
];

prismaPaths.forEach(p => {
  if (fs.existsSync(p)) {
    console.log(`✅ ${p} exists`);
    const files = fs.readdirSync(p);
    const queryEngineFiles = files.filter(f => f.includes('query_engine'));
    console.log(`   - Files: ${files.length}`);
    console.log(`   - Query Engine binaries: ${queryEngineFiles.length}`);
    if (queryEngineFiles.length > 0) {
      console.log(`   - Binary files: ${queryEngineFiles.join(', ')}`);
    }
  } else {
    console.log(`❌ ${p} does not exist`);
  }
});

// Check for specific Query Engine binary
console.log('\n🔍 Looking for specific Query Engine binary...');
const targetBinary = 'libquery_engine-rhel-openssl-3.0.x.so.node';
let foundBinary = false;

prismaPaths.forEach(p => {
  if (fs.existsSync(p)) {
    const files = fs.readdirSync(p);
    if (files.includes(targetBinary)) {
      console.log(`✅ Found ${targetBinary} in ${p}`);
      foundBinary = true;
    }
  }
});

if (!foundBinary) {
  console.log(`❌ ${targetBinary} not found in any Prisma directory`);
}

// Test Prisma client import
console.log('\n🧪 Testing Prisma client import...');
try {
  const client = require('../node_modules/.prisma/client');
  console.log('✅ @prisma/client import successful');
} catch (error) {
  console.log('❌ @prisma/client import failed:', error.message);
}

// Test business client import
console.log('\n🧪 Testing Business Prisma Client Import...');
try {
  const businessClient = require('../node_modules/.prisma/business-client');
  console.log('✅ Business Prisma client import successful');
  console.log('   - Client type:', typeof businessClient.PrismaClient);
} catch (error) {
  console.log('❌ Business Prisma client import failed:', error.message);
}

// Test database connection if URL is available
if (process.env.BUSINESS_DATABASE_URL) {
  console.log('\n🧪 Testing Database Connection...');
  const mysql = require('mysql2/promise');
  
  mysql.createConnection(process.env.BUSINESS_DATABASE_URL)
    .then(connection => {
      console.log('✅ Database connection successful');
      return connection.execute('SELECT 1 as test');
    })
    .then(([rows]) => {
      console.log('✅ Database query successful:', rows);
    })
    .catch(error => {
      console.log('❌ Database connection failed:', error.message);
      console.log('   Error code:', error.code);
    });
} else {
  console.log('\n⚠️  BUSINESS_DATABASE_URL not set, skipping database test');
}

console.log('\n📊 Summary:');
console.log('If you see Query Engine binary issues, the problem is with binary bundling.');
console.log('If you see database connection issues, the problem is with network/permissions.');
console.log('If you see import issues, the problem is with Prisma client generation.'); 