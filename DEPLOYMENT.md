# SARA Production Deployment Guide

This guide will help you deploy the SARA (Smart Analytics & Reporting Assistant) application to Vercel for production use.

## 🚀 Quick Deployment

### Prerequisites

1. **Vercel Account**: Sign up at [vercel.com](https://vercel.com)
2. **GitHub Repository**: Your code should be in a GitHub repository
3. **Database**: MySQL database (PlanetScale, AWS RDS, or similar)
4. **OpenAI API Key**: Get from [OpenAI Platform](https://platform.openai.com)

### One-Click Deploy

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/yourusername/sarav2)

### Manual Deployment Steps

#### 1. Fork/Clone Repository

```bash
git clone https://github.com/yourusername/sarav2.git
cd sarav2
```

#### 2. Install Dependencies

```bash
npm install
```

#### 3. Environment Variables Setup

Copy `env.template` to `.env.local` and fill in your values:

```bash
cp env.template .env.local
```

**Required Environment Variables:**

```env
# Database (MySQL)
BUSINESS_DATABASE_URL="mysql://username:password@host:port/database"

# OpenAI API
OPENAI_API_KEY="sk-your-openai-api-key"

# Security (generate strong random strings)
NEXTAUTH_SECRET="your-secure-random-string"
JWT_SECRET="another-secure-random-string"

# Production URL
NEXTAUTH_URL="https://your-app.vercel.app"
```

#### 4. Database Setup

```bash
# Generate Prisma clients
npm run db:generate

# Push schema to database
npm run db:push:auth
npm run db:push:business
```

#### 5. Test Locally

```bash
npm run dev
```

#### 6. Deploy to Vercel

**Option A: Via Vercel CLI**

```bash
# Install Vercel CLI
npm i -g vercel

# Login and deploy
vercel login
vercel
```

**Option B: Via GitHub Integration**

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click "New Project"
3. Import your GitHub repository
4. Configure environment variables
5. Deploy

## 📋 Environment Variables for Production

### Required Variables

| Variable                | Description             | Example                          |
| ----------------------- | ----------------------- | -------------------------------- |
| `BUSINESS_DATABASE_URL` | MySQL connection string | `mysql://user:pass@host:3306/db` |
| `OPENAI_API_KEY`        | OpenAI API key          | `sk-...`                         |
| `NEXTAUTH_SECRET`       | NextAuth.js secret      | Random 32+ char string           |
| `JWT_SECRET`            | JWT signing secret      | Random 32+ char string           |
| `NEXTAUTH_URL`          | Production URL          | `https://your-app.vercel.app`    |

### Optional Variables

| Variable              | Description            | Default  |
| --------------------- | ---------------------- | -------- |
| `OPENAI_MODEL`        | OpenAI model to use    | `gpt-4`  |
| `OPENAI_MAX_TOKENS`   | Max tokens per request | `2000`   |
| `RATE_LIMIT_REQUESTS` | Requests per window    | `100`    |
| `RATE_LIMIT_WINDOW`   | Rate limit window (ms) | `900000` |

## 🔧 Vercel Configuration

The project includes a `vercel.json` configuration file with optimized settings:

- **Build Command**: `npm run build`
- **Framework**: Next.js
- **Function Timeout**: 30 seconds for API routes
- **Regions**: `iad1` (US East)
- **Caching**: Optimized for static assets and API routes

## 🗄️ Database Setup

### Recommended Database Providers

1. **PlanetScale** (Recommended)

   - Serverless MySQL platform
   - Automatic scaling
   - Built-in branching
   - Easy Vercel integration

2. **AWS RDS**

   - Managed MySQL service
   - High availability options
   - Custom configurations

3. **Google Cloud SQL**
   - Managed MySQL service
   - Global availability
   - Automatic backups

### Database Schema Requirements

The application requires two main components:

1. **Business Database** (Read-only)

   - Contains your existing business data
   - Example: `gifts` table with donation data

2. **Application Database** (Read-write)
   - Stores saved queries, dashboards, user data
   - Managed by Prisma migrations

## 🔒 Security Considerations

### Production Security Checklist

- [ ] Strong random values for `NEXTAUTH_SECRET` and `JWT_SECRET`
- [ ] HTTPS-only URLs in production
- [ ] Database credentials stored securely
- [ ] Rate limiting enabled
- [ ] Error messages don't expose sensitive data
- [ ] Database access is read-only for business data

### Environment Variable Security

1. **Never commit `.env` files** to version control
2. **Use Vercel's Environment Variables** dashboard
3. **Rotate secrets regularly**
4. **Use different secrets** for staging and production

## 📊 Performance Optimization

### Built-in Optimizations

- **Bundle splitting** for efficient loading
- **Image optimization** with Next.js
- **API route caching** for improved performance
- **Gzip compression** enabled
- **CDN distribution** via Vercel Edge Network

### Monitoring

#### Vercel Analytics (Optional)

Add to your environment variables:

```env
NEXT_PUBLIC_VERCEL_ANALYTICS=true
```

#### Custom Analytics (Optional)

```env
GOOGLE_ANALYTICS_ID="G-XXXXXXXXXX"
```

## 🔄 Continuous Deployment

### Automatic Deployments

Vercel automatically deploys:

- **Production**: Pushes to `main` branch
- **Preview**: Pull requests and feature branches

### Manual Deployment

```bash
# Deploy specific branch
vercel --prod

# Deploy with custom domain
vercel --prod --scope your-team
```

## 🐛 Troubleshooting

### Common Issues

#### Build Failures

```bash
# Clear Next.js cache
npm run clean && npm run build

# Check TypeScript errors
npm run type-check

# Fix linting issues
npm run lint:fix
```

#### Database Connection Issues

1. Verify `DATABASE_URL` format
2. Check database server accessibility
3. Ensure database exists and has proper permissions
4. Test connection locally first

#### API Rate Limits

- Monitor Vercel function logs
- Adjust rate limiting in configuration
- Consider upgrading Vercel plan for higher limits

#### OpenAI API Issues

1. Verify API key is correct
2. Check OpenAI account usage/billing
3. Monitor rate limits on OpenAI dashboard

### Debug Mode

Enable detailed error messages in development:

```env
NODE_ENV=development
```

## 📈 Scaling Considerations

### Vercel Limits (Hobby Plan)

- **Function Duration**: 10 seconds
- **Function Memory**: 1024 MB
- **Bandwidth**: 100 GB/month
- **Requests**: 100 GB-hours of usage

### Upgrade Recommendations

For production use, consider Vercel Pro:

- **Function Duration**: 60 seconds
- **Function Memory**: 3008 MB
- **Priority support**
- **Team collaboration**

## 🔧 Advanced Configuration

### Custom Domain

1. Add domain in Vercel dashboard
2. Configure DNS records
3. SSL certificate automatically provisioned

### Team Collaboration

1. Invite team members in Vercel dashboard
2. Set up branch protection rules
3. Configure deployment permissions

### Staging Environment

```bash
# Deploy to staging
vercel --target staging

# Set staging environment variables
vercel env add STAGING_VAR staging
```

## 📞 Support

### Resources

- [Vercel Documentation](https://vercel.com/docs)
- [Next.js Documentation](https://nextjs.org/docs)
- [Prisma Documentation](https://www.prisma.io/docs)

### Common Commands

```bash
# View deployment logs
vercel logs

# Check deployment status
vercel ls

# Remove deployment
vercel rm deployment-url
```

---

## 🎉 You're Ready!

Your SARA application should now be running in production. Monitor the Vercel dashboard for performance metrics and logs.

**Production URL**: https://your-app.vercel.app

For additional support or customization needs, refer to the documentation links above or contact your development team.
