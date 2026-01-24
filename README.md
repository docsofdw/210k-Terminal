# 210k Terminal

Bitcoin treasury company analytics.

## Tech Stack

- Frontend: [Next.js 15](https://nextjs.org/docs), [Tailwind CSS](https://tailwindcss.com/docs/guides/nextjs), [Shadcn UI](https://ui.shadcn.com/docs/installation), [Framer Motion](https://www.framer.com/motion/introduction/)
- Backend: [PostgreSQL](https://www.postgresql.org/about/), [Supabase](https://supabase.com/), [Drizzle ORM](https://orm.drizzle.team/docs/get-started-postgresql), [Server Actions](https://nextjs.org/docs/app/building-your-application/data-fetching/server-actions-and-mutations)
- Auth: [Clerk](https://clerk.com/)
- Charts: [Recharts](https://recharts.org/)

## Features

- **Treasury Comps Table**: Compare 15+ Bitcoin treasury companies with mNAV, premium/discount, sats per share
- **Real-time BTC Prices**: Live Bitcoin price updates integrated into all calculations
- **Portfolio Tracking**: Track positions with cost basis, P&L, and portfolio weight analysis
- **Historical Charts**: Visualize mNAV trends, holdings growth, and comparative performance
- **Price Alerts**: Telegram and Slack notifications for price thresholds and mNAV changes
- **Role-Based Access**: Admin and viewer roles for team access control

## Environment Variables

```bash
# Database
DATABASE_URL=
DIRECT_URL=

# Clerk Auth
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/login
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/signup

# Cron Jobs
CRON_SECRET=

# Notifications (optional)
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=
SLACK_WEBHOOK_URL=
```

## Setup

1. Clone the repository
2. Copy `.env.example` to `.env.local` and fill in the environment variables
3. Run `npm install` to install dependencies
4. Run `npx drizzle-kit push` to set up the database schema
5. Run `npx bun db/seed` to seed initial company data
6. Run `npm run dev` to start the development server

## Development

```bash
npm run dev      # Start dev server
npm run build    # Build for production
npm run lint     # Run ESLint
npm run clean    # Lint and format
```

## Database

```bash
npx drizzle-kit push      # Push schema changes
npx drizzle-kit generate  # Generate migrations
npx bun db/seed           # Seed company data
```
