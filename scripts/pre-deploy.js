#!/usr/bin/env node

/**
 * Pre-deployment validation script for SARA
 * Validates environment, dependencies, and configuration before deployment
 */

const fs = require('fs')
const path = require('path')

console.log('🚀 Starting pre-deployment validation...\n')

// Check Node.js version
function checkNodeVersion() {
  const requiredVersion = '18.17.0'
  const currentVersion = process.version.slice(1) // Remove 'v' prefix
  
  console.log(`📦 Node.js version: ${currentVersion}`)
  
  if (compareVersions(currentVersion, requiredVersion) < 0) {
    console.error(`❌ Node.js ${requiredVersion} or higher is required`)
    process.exit(1)
  }
  
  console.log('✅ Node.js version is compatible\n')
}

// Check required files
function checkRequiredFiles() {
  const requiredFiles = [
    'package.json',
    'next.config.mjs',
    'vercel.json',
    'env.template',
    '.npmrc',
    'lib/config.ts',
    'lib/rate-limiter.ts',
  ]
  
  console.log('📁 Checking required files...')
  
  for (const file of requiredFiles) {
    if (!fs.existsSync(file)) {
      console.error(`❌ Missing required file: ${file}`)
      process.exit(1)
    }
    console.log(`✅ ${file}`)
  }
  
  console.log('✅ All required files present\n')
}

// Check package.json dependencies
function checkDependencies() {
  console.log('📦 Checking dependencies...')
  
  const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'))
  
  // Check for problematic dependency patterns
  const deps = { ...packageJson.dependencies, ...packageJson.devDependencies }
  
  let hasIssues = false
  
  for (const [name, version] of Object.entries(deps)) {
    if (version === 'latest') {
      console.warn(`⚠️  Dependency ${name} uses 'latest' version`)
      hasIssues = true
    }
    
    if (version.includes('file:') || version.includes('link:')) {
      console.error(`❌ Local dependency detected: ${name}`)
      process.exit(1)
    }
  }
  
  if (hasIssues) {
    console.warn('⚠️  Some dependencies may cause version conflicts\n')
  } else {
    console.log('✅ Dependencies look good\n')
  }
}

// Check environment template
function checkEnvironmentTemplate() {
  console.log('🔧 Checking environment template...')
  
  if (!fs.existsSync('env.template')) {
    console.error('❌ env.template file is missing')
    process.exit(1)
  }
  
  const envTemplate = fs.readFileSync('env.template', 'utf8')
  const requiredVars = [
    'DATABASE_URL',
    'OPENAI_API_KEY',
    'NEXTAUTH_SECRET',
    'JWT_SECRET',
    'NEXTAUTH_URL',
  ]
  
  for (const variable of requiredVars) {
    if (!envTemplate.includes(variable)) {
      console.error(`❌ Missing required environment variable in template: ${variable}`)
      process.exit(1)
    }
  }
  
  console.log('✅ Environment template is complete\n')
}

// Check build configuration
function checkBuildConfig() {
  console.log('🔨 Checking build configuration...')
  
  const nextConfig = fs.readFileSync('next.config.mjs', 'utf8')
  const vercelConfig = JSON.parse(fs.readFileSync('vercel.json', 'utf8'))
  
  // Check if build command exists
  if (!vercelConfig.buildCommand) {
    console.error('❌ No build command specified in vercel.json')
    process.exit(1)
  }
  
  console.log('✅ Build configuration is valid\n')
}

// Utility function to compare versions
function compareVersions(a, b) {
  const aParts = a.split('.').map(Number)
  const bParts = b.split('.').map(Number)
  
  for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
    const aPart = aParts[i] || 0
    const bPart = bParts[i] || 0
    
    if (aPart > bPart) return 1
    if (aPart < bPart) return -1
  }
  
  return 0
}

// Run all checks
function runValidation() {
  try {
    checkNodeVersion()
    checkRequiredFiles()
    checkDependencies()
    checkEnvironmentTemplate()
    checkBuildConfig()
    
    console.log('🎉 Pre-deployment validation passed!')
    console.log('✅ Ready for deployment to Vercel\n')
    
    console.log('📋 Next steps:')
    console.log('1. Set environment variables in Vercel dashboard')
    console.log('2. Deploy using: vercel --prod')
    console.log('3. Monitor deployment in Vercel dashboard\n')
    
  } catch (error) {
    console.error('❌ Pre-deployment validation failed:', error.message)
    process.exit(1)
  }
}

// Run the validation
runValidation() 