#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🔧 Setting up Prisma Query Engine binaries...');

try {
  // Check if business client exists
  const businessClientPath = path.join(__dirname, '../node_modules/.prisma/client');

  if (!fs.existsSync(businessClientPath)) {
    console.log('📦 Generating Prisma client...');
    execSync('npx prisma generate', { stdio: 'inherit' });
  }

  console.log('✅ Prisma client ready');

} catch (error) {
  console.error('❌ Failed to setup Prisma binaries:', error.message);
  process.exit(1);
} 