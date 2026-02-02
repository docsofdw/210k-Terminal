import { config } from "dotenv"
import { drizzle as drizzlePostgres } from "drizzle-orm/postgres-js"
import postgres from "postgres"

// Schema imports
import { alertHistory } from "./schema/alert-history"
import { alerts } from "./schema/alerts"
import { auditLog } from "./schema/audit-log"
import { btcPrices } from "./schema/btc-prices"
import { companies } from "./schema/companies"
import { customers } from "./schema/customers"
import { dailySnapshots, marketSnapshots } from "./schema/daily-snapshots"
import { fxRates } from "./schema/fx-rates"
import {
  fundPerformanceSnapshots,
  fundStatistics
} from "./schema/fund-performance"
import { fundPositions } from "./schema/fund-positions"
import { holdingsSnapshots } from "./schema/holdings-snapshots"
import { portfolioPositions } from "./schema/portfolio-positions"
import { savedStrategies } from "./schema/saved-strategies"
import { stockPrices } from "./schema/stock-prices"

config({ path: ".env.local" })

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) {
  throw new Error("DATABASE_URL is not set")
}

const dbSchema = {
  // Core tables
  customers,
  companies,

  // Market data
  btcPrices,
  stockPrices,
  fxRates,

  // Snapshots
  holdingsSnapshots,
  dailySnapshots,
  marketSnapshots,

  // Portfolio
  portfolioPositions,

  // Saved strategies
  savedStrategies,

  // Fund positions (from Google Sheet)
  fundPositions,

  // Fund performance analytics
  fundPerformanceSnapshots,
  fundStatistics,

  // Alerts
  alerts,
  alertHistory,

  // Audit
  auditLog
}

function initializeDb(url: string) {
  const client = postgres(url, { prepare: false })
  return drizzlePostgres(client, { schema: dbSchema })
}

export const db = initializeDb(databaseUrl)
