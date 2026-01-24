# Treasury Company Intelligence Platform

**Version:** 1.0
**Client:** 210k Capital
**Status:** Planning

## Executive Summary

The Treasury Company Intelligence Platform is a web-based application designed to replace the existing Google Sheets tracker used by 210k Capital for monitoring Bitcoin treasury companies. The platform provides real-time market data, portfolio tracking, scenario modeling, and automated alerts for a team of 13 users.

## Business Context

210k Capital is an internal fund that invests in publicly traded companies holding Bitcoin on their balance sheets. The current Google Sheets solution has limitations in:
- Automation
- Multi-user collaboration
- Advanced analytics

This platform addresses these gaps while maintaining the calculation logic the team relies on.

## Success Metrics

| Metric | Target |
|--------|--------|
| Manual data entry reduction | 80% |
| Price update latency | Real-time (vs. manual refresh) |
| Alert delay | < 5 minutes |
| Scenario modeling | Capabilities not possible in spreadsheets |

## Technical Constraints

| Constraint | Value |
|------------|-------|
| Budget | < $500/year (hosting + APIs) |
| Timeline | 6-10 weeks full build |
| Starting template | mckays-app-template (Next.js + Supabase + Clerk) |
| Backup requirement | Google Sheets must remain as manual backup |

## User Roles

| Role | Count | Permissions | Notifications |
|------|-------|-------------|---------------|
| Admin/Editor | 3 | Full CRUD, approve AI extractions, manage users, export | Telegram + Slack |
| Viewer | 10 | Read-only dashboards, charts, reports | Slack only |

**Telegram Power Users:** Two users (primary + Namcios) receive Telegram notifications with quick-action links to admin dashboard.

## Phase Breakdown

### Phase 1: MVP (Weeks 1-6)

| Week | Deliverables |
|------|--------------|
| 1-2 | Project setup, database schema, company data seeding, basic auth |
| 2-3 | Stock/BTC price APIs, FX rates, Comps Table UI with calculations |
| 3-4 | Portfolio tracking (positions, transactions), portfolio UI |
| 4-5 | Alert system (Telegram + Slack), admin data entry forms |
| 5-6 | Historical charts, snapshot system, audit log, testing |
| 6 | Data migration, parallel run, bug fixes |

### Phase 2: Advanced Features (Weeks 7-10)

| Week | Deliverables |
|------|--------------|
| 7 | Hypothetical Comps (scenario editor with recalculation) |
| 8 | Monte Carlo simulation UI and calculation engine |
| 8-9 | Black-Scholes convertible bond analyzer |
| 9-10 | Company deep-dive pages, market dashboard, polish |

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 15 (App Router), React Server Components |
| Styling | Tailwind CSS + shadcn/ui (dark mode default) |
| Database | Supabase (PostgreSQL) with Row Level Security |
| ORM | Drizzle |
| Auth | Clerk |
| Hosting | Vercel (free tier) |
| Background Jobs | Vercel Cron + Edge Functions |
| Notifications | Telegram Bot API + Slack Webhooks |
| Charts | Recharts or TradingView lightweight |

## Documentation Index

- [Features](./FEATURES.md) - MVP and Phase 2 feature specifications
- [Data Model](./DATA_MODEL.md) - Database schema and relationships
- [Calculations](./CALCULATIONS.md) - Business logic and formulas
- [API Integrations](./API_INTEGRATIONS.md) - External API specifications
- [Alerts](./ALERTS.md) - Alert system and notification specs
- [Companies](./COMPANIES.md) - Master list of tracked companies

## Migration Plan

1. **Data Migration**
   - Export Comps Table history from Google Sheets
   - Export Portfolio positions from Live Portfolio sheet
   - Parse and validate data format
   - Import into Supabase with audit trail
   - Verify calculations match

2. **Parallel Running**
   - Run both systems for 2 weeks
   - Ensure parity before retiring Sheets

3. **Backup Strategy**
   - Manual CSV export functionality
   - User uploads to Google Drive as needed
