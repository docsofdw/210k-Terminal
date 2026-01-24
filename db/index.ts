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
import { fxRates } from "./schema/fx-rates"
import { holdingsSnapshots } from "./schema/holdings-snapshots"
import { portfolioPositions } from "./schema/portfolio-positions"
import { portfolioTransactions } from "./schema/portfolio-transactions"
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

  // Portfolio
  portfolioPositions,
  portfolioTransactions,

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
