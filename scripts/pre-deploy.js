#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 Starting pre-deployment setup...');

try {
  // Clean previous builds
  console.log('🧹 Cleaning previous builds...');
  execSync('rm -rf .next', { stdio: 'inherit' });
  execSync('rm -rf node_modules/.prisma', { stdio: 'inherit' });

  // Install dependencies
  console.log('📦 Installing dependencies...');
  execSync('npm install', { stdio: 'inherit' });

  // Generate Prisma clients
  console.log('🔧 Generating Prisma clients...');
  execSync('npm run db:generate', { stdio: 'inherit' });

  // Verify Prisma clients were generated
  const businessClientPath = path.join(__dirname, '../node_modules/.prisma/client');

  if (!fs.existsSync(businessClientPath)) {
    throw new Error('Prisma client was not generated');
  }

  console.log('✅ Prisma client generated successfully');

  // Check for Query Engine binaries
  const prismaDir = path.join(__dirname, '../node_modules/.prisma/client');
  if (fs.existsSync(prismaDir)) {
    const files = fs.readdirSync(prismaDir);
    const queryEngineFiles = files.filter(file => file.includes('query_engine'));
    console.log(`🔍 Found ${queryEngineFiles.length} Query Engine binary(ies)`);
  }

  console.log('✅ Pre-deployment setup completed successfully');

} catch (error) {
  console.error('❌ Pre-deployment setup failed:', error.message);
  process.exit(1);
} 