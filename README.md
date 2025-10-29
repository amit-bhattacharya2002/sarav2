# SARA v2 - Smart Analytics & Reporting Assistant

[![Deployed on Vercel](https://img.shields.io/badge/Deployed%20on-Vercel-black?style=for-the-badge&logo=vercel)](https://sarav2.vercel.app)
[![Next.js](https://img.shields.io/badge/Next.js-15.2.4-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7.2-blue?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)

## Overview

SARA v2 is an intelligent analytics and reporting assistant that enables business users to query their data using natural language. Built with Next.js, TypeScript, and AI integration, it provides a user-friendly interface for data exploration and visualization.

## Features

- 🤖 **AI-Powered Query Generation**: Convert natural language to SQL queries
- 📊 **Interactive Dashboards**: Drag-and-drop chart creation and customization
- 🔒 **Secure Authentication**: User authentication and data protection
- 📈 **Multiple Chart Types**: Bar charts, pie charts, and data tables
- 💾 **Query History**: Save and manage previous queries
- 🔗 **Shareable Dashboards**: Generate shareable links for dashboards
- 🎨 **Modern UI**: Built with Radix UI and Tailwind CSS

## Tech Stack

- **Frontend**: Next.js 15, React 19, TypeScript
- **Styling**: Tailwind CSS, Radix UI
- **Database**: Prisma ORM with MySQL/MongoDB support
- **AI**: OpenAI GPT integration
- **Deployment**: Vercel
- **Charts**: Recharts

## Getting Started

1. Clone the repository
2. Install dependencies: `npm install`
3. Set up environment variables (see `.env.template`)
4. Run the development server: `npm run dev`
5. Open [http://localhost:3000](http://localhost:3000) in your browser

## Deployment

This project is configured for deployment on Vercel. The deployment will be available at your Vercel project URL once configured.

## Environment Variables

Copy `.env.template` to `.env.local` and configure the following variables:

- Database connection strings
- OpenAI API key
- Authentication secrets
- Other service configurations

## Contributing

This is a private project. For any changes or improvements, please contact the maintainer.
