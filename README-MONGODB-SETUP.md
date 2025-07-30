# MongoDB and Prisma Setup Guide

## Overview

This project has been migrated from MySQL to MongoDB with Prisma ORM. The database now includes models for a constituent management system with addresses, constituents, and gifts.

## Prerequisites

1. MongoDB database (local or cloud like MongoDB Atlas)
2. Node.js and npm installed

## Setup Steps

### 1. Install Dependencies

```bash
npm install
```

### 2. Environment Variables

Create a `.env` file in the root directory with the following variables:

```env
# MongoDB Database Configuration
DATABASE_URL="mongodb+srv://username:password@cluster.mongodb.net/database_name?retryWrites=true&w=majority"

# OpenAI API Key
OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### 3. Generate Prisma Client

```bash
npm run db:generate
```

### 4. Push Schema to Database

```bash
npm run db:push
```

### 5. Seed the Database with Sample Data

```bash
npm run db:seed
```

This will create:

- 3 sample constituents (John Doe, Jane Smith, Bob Johnson)
- 3 sample addresses (Maple Ridge, Richmond, North Vancouver)
- 5 sample gifts with various amounts and designations
- Schema definition for AI query generation

### 6. View Data in Prisma Studio (Optional)

```bash
npm run db:studio
```

## Database Schema

### Main Data Models

- **Constituent**: Stores donor/constituent information
- **Address**: Stores address information linked to constituents
- **Gift**: Stores donation/gift information linked to constituents

### Application Models

- **SavedQuery**: Stores saved queries with their metadata
- **SavedDashboard**: Stores dashboard configurations
- **SchemaDefinition**: Stores database schema information for AI generation

## Sample Data Included

### Constituents

- John Doe (john.doe@example.com)
- Jane Smith (jane.smith@example.com)
- Bob Johnson (bob.johnson@example.com)

### Gifts

- Various gift amounts ($250-$1500)
- Different source codes (Web Gift, Direct Mail, Email, Phone Call, Personal Solicitation)
- Multiple designations (Student Bursaries Fund, 88 Keys Campaign, Engineering Equipment Endowment)
- Different payment methods (Credit Card, Check)

## AI Query Examples

With the seeded data, you can now ask questions like:

- "Show me total gifts by designation"
- "What are the top 3 donors by amount?"
- "How many gifts were made via Credit Card?"
- "Show gifts by source code"
- "What is the total amount donated to Student Bursaries Fund?"

## Important Notes

### SQL to MongoDB Migration

The application now generates MongoDB aggregation pipelines instead of SQL queries. The AI model has been updated to generate MongoDB aggregation syntax.

### API Changes

- All database operations now use Prisma instead of raw SQL
- Query execution is currently a placeholder - you'll need to implement MongoDB aggregation pipeline execution
- The `/api/query` endpoint now saves queries but doesn't execute them (placeholder implementation)

## Next Steps

1. **Implement MongoDB Query Execution**: You'll need to implement the actual execution of MongoDB aggregation pipelines in the `/api/query` route.

2. **Test the Application**: Run `npm run dev` and test the application functionality with the seeded data.

3. **Customize Schema**: Modify the schema definition in the seed file to match your actual database structure.

## Troubleshooting

- If you get Prisma client errors, run `npm run db:generate` again
- If you get connection errors, check your `DATABASE_URL` format
- For MongoDB Atlas, ensure your IP is whitelisted and credentials are correct
- If the seed fails, make sure your MongoDB connection is working properly
