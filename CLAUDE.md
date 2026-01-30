# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

210k Terminal - Bitcoin treasury company analytics for 210k Capital. Supports 13 users (3 admins, 10 viewers).

## Commands

### Development
- `npm run dev` - Start development server with Turbopack
- `npm run build` - Build for production
- `npm run start` - Start production server

### Code Quality
- `npm run lint` - Run ESLint
- `npm run lint:fix` - Run ESLint with auto-fix
- `npm run types` - Run TypeScript type checking
- `npm run format:write` - Format code with Prettier
- `npm run clean` - Run both lint:fix and format:write

### Database
- `npx drizzle-kit push` - Push schema changes to database
- `npx drizzle-kit generate` - Generate migration files
- `npx drizzle-kit migrate` - Run migrations
- `npx bun db/seed` - Seed database with treasury companies
- `npx supabase start` - Start local Supabase instance

### Historical Data Backfill
- `npm run db:backfill` - Run all backfills (FX, BTC, stocks) for 1 year
- `npm run db:backfill:btc` - Backfill BTC prices from CoinGecko
- `npm run db:backfill:fx` - Backfill FX rates
- `npm run db:backfill:stocks` - Backfill stock prices from Yahoo Finance

See [docs/HISTORICAL_DATA.md](./docs/HISTORICAL_DATA.md) for detailed documentation.

### Testing
- `npm run test` - Run all tests (unit + e2e)
- `npm run test:unit` - Run Jest unit tests
- `npm run test:e2e` - Run Playwright e2e tests

### Shadcn UI Components
- `npx shadcn@latest add [component-name]` - Install new Shadcn UI components

## Architecture

This is a Next.js 15 treasury intelligence platform using the App Router with role-based access control.

### Route Structure
- `/app/(unauthenticated)` - Public routes
  - `(marketing)` - Landing page with platform features
  - `(auth)` - Login and signup flows
- `/app/(authenticated)` - Protected routes requiring Clerk auth
  - `dashboard/comps` - Treasury companies comparison table
  - `dashboard/portfolio` - Position tracking
  - `dashboard/charts` - Value Screener and company analysis
  - `dashboard/alerts` - Price alert management
  - `dashboard/admin` - Admin-only company and user management
- `/app/api` - API routes including cron jobs for price updates

### Database Schema (`/db/schema/`)
- `customers.ts` - User accounts with role enum (admin/viewer)
- `companies.ts` - Treasury company master data (15 companies)
- `stock-prices.ts` - Historical stock price data
- `btc-prices.ts` - Bitcoin price history
- `fx-rates.ts` - Currency conversion rates
- `holdings-snapshots.ts` - Point-in-time BTC holdings

### Key Patterns
- **Server Actions** in `/actions` for data mutations (companies, market-data)
- **Calculations** in `/lib/calculations.ts` for mNAV, EV, sats per share
- **UI Components** in `/components/ui` from Shadcn UI library
- **Authentication** handled by Clerk middleware with role-based access
- **Role System**: `admin` (full access) and `viewer` (read-only)

### Treasury Metrics Formulas
```
mNAV = Enterprise Value / BTC NAV
Enterprise Value = Market Cap + Debt + Preferreds - Cash
BTC NAV = BTC Holdings * BTC Price
Sats per Share = (BTC Holdings * 100,000,000) / Shares Outstanding
Premium/Discount = (mNAV - 1) * 100%
```

### Data Flow
1. Authentication state managed by Clerk (`@clerk/nextjs`)
2. User roles stored in PostgreSQL customers table
3. Company and market data fetched via server actions
4. Cron jobs update prices:
   - BTC price: every 1 min (`/api/cron/btc-price`)
   - Stock prices: every 15 min (`/api/cron/stock-prices`)
   - Stock prices + snapshots: every 1 hour (`/api/cron/stock-prices-hourly`)
   - Daily snapshots: midnight UTC (`/api/cron/daily-snapshot`)
5. Calculations performed in real-time using `/lib/calculations.ts`
6. Charts read from `daily_snapshots` table with USD toggle support

### Environment Variables Required
- `DATABASE_URL` - Supabase pooled connection (port 6543)
- `DIRECT_URL` - Supabase direct connection (port 5432)
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` - Clerk public key
- `CLERK_SECRET_KEY` - Clerk secret key
- `CRON_SECRET` - Secret for securing cron endpoints
