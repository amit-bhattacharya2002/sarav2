#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 Vercel Build Setup for Prisma...');

try {
  // Set Vercel-specific environment variables (but not during generation)
  process.env.VERCEL = '1';
  process.env.NODE_ENV = 'production';

  console.log('✅ Environment variables set for Vercel');

  // Generate Prisma clients
  console.log('🔧 Generating Prisma clients...');
  execSync('npx prisma generate', { stdio: 'inherit' });

  // Verify Prisma clients were generated
  const clientPath = path.join(__dirname, '../node_modules/.prisma/client');

  if (!fs.existsSync(clientPath)) {
    throw new Error('Prisma client generation failed');
  }

  console.log('✅ Prisma clients generated successfully');

  // Copy Query Engine binaries to client directory
  const prismaClientPath = path.join(__dirname, '../node_modules/.prisma/client');
  if (fs.existsSync(prismaClientPath)) {
    const files = fs.readdirSync(prismaClientPath);
    const queryEngineFiles = files.filter(file => file.includes('query_engine'));
    
    console.log(`🔍 Found ${queryEngineFiles.length} Query Engine binary(ies):`, queryEngineFiles);

    // Only copy the Linux binary for Vercel deployment
    const linuxBinary = 'libquery_engine-rhel-openssl-3.0.x.so.node';
    if (queryEngineFiles.includes(linuxBinary)) {
      const sourcePath = path.join(prismaClientPath, linuxBinary);
      const targetPath = path.join(clientPath, linuxBinary);
      
      if (!fs.existsSync(targetPath)) {
        console.log(`📋 Copying ${linuxBinary} to client...`);
        fs.copyFileSync(sourcePath, targetPath);
      }
    } else {
      console.log(`⚠️  Linux binary ${linuxBinary} not found, skipping copy`);
    }
  }

  // Create .next directory structure for Vercel
  const nextServerPath = path.join(__dirname, '../.next/server');
  if (!fs.existsSync(nextServerPath)) {
    fs.mkdirSync(nextServerPath, { recursive: true });
  }

  const nextServerPrismaPath = path.join(nextServerPath, 'node_modules/.prisma');
  if (!fs.existsSync(nextServerPrismaPath)) {
    fs.mkdirSync(nextServerPrismaPath, { recursive: true });
  }

  // Copy Prisma directories to .next/server for Vercel
  const prismaDirs = ['client'];
  prismaDirs.forEach(dir => {
    const sourcePath = path.join(__dirname, `../node_modules/.prisma/${dir}`);
    const targetPath = path.join(__dirname, '../.next/server/node_modules/.prisma', dir);
    
    if (fs.existsSync(sourcePath)) {
      console.log(`📋 Copying ${dir} to .next/server...`);
      fs.mkdirSync(path.dirname(targetPath), { recursive: true });
      fs.cpSync(sourcePath, targetPath, { recursive: true });
    }
  });

  console.log('✅ Vercel build setup completed successfully');

} catch (error) {
  console.error('❌ Vercel build setup failed:', error.message);
  process.exit(1);
} 