#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🔧 Setting up Prisma Query Engine binaries...');

try {
  // Check if Prisma clients exist
  const businessClientPath = path.join(__dirname, '../node_modules/.prisma/business-client');
  const authClientPath = path.join(__dirname, '../node_modules/.prisma/auth-client');
  const prismaClientPath = path.join(__dirname, '../node_modules/.prisma/client');

  if (!fs.existsSync(businessClientPath)) {
    console.log('📦 Generating business Prisma client...');
    execSync('npx prisma generate --schema=prisma/business-schema.prisma', { stdio: 'inherit' });
  }

  if (!fs.existsSync(authClientPath)) {
    console.log('📦 Generating auth Prisma client...');
    execSync('npx prisma generate --schema=prisma/auth-schema.prisma', { stdio: 'inherit' });
  }

  // Check for Query Engine binaries
  if (fs.existsSync(prismaClientPath)) {
    const files = fs.readdirSync(prismaClientPath);
    const queryEngineFiles = files.filter(file => file.includes('query_engine'));
    console.log(`🔍 Found ${queryEngineFiles.length} Query Engine binary(ies):`, queryEngineFiles);

    // Copy Query Engine binaries to business-client directory
    queryEngineFiles.forEach(file => {
      const sourcePath = path.join(prismaClientPath, file);
      const targetPath = path.join(businessClientPath, file);
      
      if (!fs.existsSync(targetPath)) {
        console.log(`📋 Copying ${file} to business-client...`);
        fs.copyFileSync(sourcePath, targetPath);
      }
    });

    // Copy Query Engine binaries to auth-client directory
    queryEngineFiles.forEach(file => {
      const sourcePath = path.join(prismaClientPath, file);
      const targetPath = path.join(authClientPath, file);
      
      if (!fs.existsSync(targetPath)) {
        console.log(`📋 Copying ${file} to auth-client...`);
        fs.copyFileSync(sourcePath, targetPath);
      }
    });
  }

  console.log('✅ Prisma Query Engine binaries setup completed successfully');

} catch (error) {
  console.error('❌ Failed to setup Prisma binaries:', error.message);
  process.exit(1);
} 