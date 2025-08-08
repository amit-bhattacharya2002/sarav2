# Prisma Deployment Fix for Vercel

This document outlines the fixes implemented to resolve the Prisma Query Engine binary issue on Vercel deployment.

## Problem

The error `PrismaClientInitializationError: Prisma Client could not locate the Query Engine for runtime "rhel-openssl-3.0.x"` occurs because:

1. Prisma Query Engine binaries are not properly bundled with the Next.js application
2. The deployment environment can't find the required binary files
3. Environment variables for Prisma are not properly set

## Solutions Implemented

### 1. Updated Prisma Schema Configuration

Both `prisma/auth-schema.prisma` and `prisma/business-schema.prisma` now include:

```prisma
generator client {
    provider = "prisma-client-js"
    output   = "../node_modules/.prisma/business-client"
    binaryTargets = ["native", "rhel-openssl-3.0.x"]
}
```

### 2. Enhanced Next.js Configuration

Updated `next.config.mjs` to:

- Handle Prisma binary files properly
- Set environment variables for Prisma Query Engine
- Copy Query Engine binaries to the output directory
- Configure webpack to handle `.node` and `.so` files

### 3. Robust Prisma Client Configuration

Updated `lib/business-prisma.ts` to:

- Set required environment variables dynamically
- Handle connection errors gracefully
- Provide fallback for missing clients
- Force binary engine type for deployment

### 4. Deployment Scripts

Created several scripts to handle deployment:

- `scripts/setup-prisma-env.js` - Sets up environment variables
- `scripts/fix-prisma-deployment.js` - Comprehensive fix for deployment issues
- `scripts/pre-deploy.js` - Pre-deployment validation and setup

### 5. Updated Build Process

Modified `package.json` to:

- Include Prisma environment setup in build process
- Generate Prisma clients before building
- Add deployment-specific scripts

## Environment Variables Required

Ensure these environment variables are set in your Vercel dashboard:

```bash
# Database URLs
BUSINESS_DATABASE_URL="mysql://username:password@hostname:port/database_name"
AUTH_DATABASE_URL="mysql://username:password@hostname:port/auth_database_name"
```

## Deployment Steps

1. **Set Environment Variables**: Configure all required environment variables in Vercel dashboard

2. **Run Fix Script** (if needed):

   ```bash
   npm run fix-prisma
   ```

3. **Deploy**:
   ```bash
   npm run deploy
   ```

## Troubleshooting

### If the error persists:

1. **Check Environment Variables**: Ensure all database URLs are correctly set in Vercel

2. **Regenerate Prisma Clients**:

   ```bash
   npm run db:generate
   ```

3. **Clean and Rebuild**:

   ```bash
   npm run clean
   npm install
   npm run build
   ```

4. **Check Binary Files**: Verify that Query Engine binaries are present:
   ```bash
   ls node_modules/.prisma/client/
   ```

### Common Issues:

1. **Missing Database URL**: Ensure `BUSINESS_DATABASE_URL` is set correctly
2. **Network Issues**: Check if your database is accessible from Vercel's servers
3. **Permission Issues**: Ensure the database user has proper permissions

## Monitoring

After deployment, monitor the application logs in Vercel dashboard for any Prisma-related errors. The enhanced error handling will provide more detailed information about connection issues.

## Files Modified

- `next.config.mjs` - Webpack configuration for Prisma binaries
- `lib/business-prisma.ts` - Enhanced Prisma client configuration
- `prisma/business-schema.prisma` - Added binary targets
- `prisma/auth-schema.prisma` - Added binary targets
- `package.json` - Updated build scripts
- `vercel.json` - Added build environment variables
- `scripts/` - New deployment scripts

## Additional Notes

- The fix ensures compatibility with Vercel's serverless environment
- Query Engine binaries are properly bundled with the application
- Environment variables are set automatically during build
- Error handling prevents application crashes due to database connection issues
