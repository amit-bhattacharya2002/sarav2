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

  // Generate Prisma clients (without problematic env vars)
  console.log('🔧 Generating Prisma clients...');
  execSync('npx prisma generate --schema=prisma/auth-schema.prisma', { stdio: 'inherit' });
  execSync('npx prisma generate --schema=prisma/business-schema.prisma', { stdio: 'inherit' });

  // Verify clients were generated
  const businessClientPath = path.join(__dirname, '../node_modules/.prisma/business-client');
  const authClientPath = path.join(__dirname, '../node_modules/.prisma/auth-client');

  if (!fs.existsSync(businessClientPath)) {
    throw new Error('Business Prisma client generation failed');
  }

  if (!fs.existsSync(authClientPath)) {
    throw new Error('Auth Prisma client generation failed');
  }

  console.log('✅ Prisma clients generated successfully');

  // Copy Query Engine binaries to all required locations
  const prismaClientPath = path.join(__dirname, '../node_modules/.prisma/client');
  if (fs.existsSync(prismaClientPath)) {
    const files = fs.readdirSync(prismaClientPath);
    const queryEngineFiles = files.filter(file => file.includes('query_engine'));
    
    console.log(`🔍 Found ${queryEngineFiles.length} Query Engine binary(ies):`, queryEngineFiles);

    // Copy to business-client directory
    queryEngineFiles.forEach(file => {
      const sourcePath = path.join(prismaClientPath, file);
      const targetPath = path.join(businessClientPath, file);
      
      if (!fs.existsSync(targetPath)) {
        console.log(`📋 Copying ${file} to business-client...`);
        fs.copyFileSync(sourcePath, targetPath);
      }
    });

    // Copy to auth-client directory
    queryEngineFiles.forEach(file => {
      const sourcePath = path.join(prismaClientPath, file);
      const targetPath = path.join(authClientPath, file);
      
      if (!fs.existsSync(targetPath)) {
        console.log(`📋 Copying ${file} to auth-client...`);
        fs.copyFileSync(sourcePath, targetPath);
      }
    });
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
  const prismaDirs = ['client', 'business-client', 'auth-client'];
  prismaDirs.forEach(dir => {
    const sourcePath = path.join(__dirname, `../node_modules/.prisma/${dir}`);
    const targetPath = path.join(nextServerPath, `node_modules/.prisma/${dir}`);
    
    if (fs.existsSync(sourcePath)) {
      if (!fs.existsSync(targetPath)) {
        fs.mkdirSync(targetPath, { recursive: true });
      }
      
      // Copy all files from source to target
      const files = fs.readdirSync(sourcePath);
      files.forEach(file => {
        const sourceFile = path.join(sourcePath, file);
        const targetFile = path.join(targetPath, file);
        
        if (fs.statSync(sourceFile).isFile()) {
          fs.copyFileSync(sourceFile, targetFile);
        }
      });
      
      console.log(`📋 Copied ${dir} to .next/server/node_modules/.prisma/`);
    }
  });

  console.log('✅ Vercel build setup completed successfully');

} catch (error) {
  console.error('❌ Vercel build setup failed:', error.message);
  process.exit(1);
} 