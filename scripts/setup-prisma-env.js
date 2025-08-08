#!/usr/bin/env node

console.log('🔧 Setting up Prisma environment for deployment...');

// Set additional environment variables for deployment
process.env.NODE_ENV = process.env.NODE_ENV || 'production';

console.log('✅ Prisma environment variables set:');
console.log('- NODE_ENV:', process.env.NODE_ENV);

// Export for use in other scripts
module.exports = {
  NODE_ENV: 'production',
}; 