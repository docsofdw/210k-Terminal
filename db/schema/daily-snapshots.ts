import { decimal, index, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core"
import { companies } from "./companies"

// Stores daily snapshots of company data for historical analysis
export const dailySnapshots = pgTable(
  "daily_snapshots",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    // Date of the snapshot (normalized to midnight UTC)
    snapshotDate: timestamp("snapshot_date").notNull(),

    // Company reference
    companyId: uuid("company_id")
      .references(() => companies.id, { onDelete: "cascade" })
      .notNull(),

    // Company identifiers (denormalized for historical accuracy)
    ticker: text("ticker").notNull(),
    companyName: text("company_name").notNull(),

    // Market Data
    stockPrice: decimal("stock_price", { precision: 20, scale: 4 }),
    stockPriceUsd: decimal("stock_price_usd", { precision: 20, scale: 4 }),
    marketCapUsd: decimal("market_cap_usd", { precision: 20, scale: 2 }),

    // BTC Data
    btcPrice: decimal("btc_price", { precision: 20, scale: 2 }).notNull(),
    btcHoldings: decimal("btc_holdings", { precision: 20, scale: 8 }),
    btcNav: decimal("btc_nav", { precision: 20, scale: 2 }),

    // Calculated Metrics
    evUsd: decimal("ev_usd", { precision: 20, scale: 2 }),
    mNav: decimal("m_nav", { precision: 10, scale: 4 }),
    satsPerShare: decimal("sats_per_share", { precision: 20, scale: 0 }),
    btcPerShare: decimal("btc_per_share", { precision: 20, scale: 8 }),

    // Balance Sheet (point-in-time)
    sharesOutstanding: decimal("shares_outstanding", { precision: 20, scale: 0 }),
    cashUsd: decimal("cash_usd", { precision: 20, scale: 2 }),
    debtUsd: decimal("debt_usd", { precision: 20, scale: 2 }),
    preferredsUsd: decimal("preferreds_usd", { precision: 20, scale: 2 }),

    // FX Rate used
    fxRate: decimal("fx_rate", { precision: 20, scale: 6 }),
    tradingCurrency: text("trading_currency"),

    // Source tracking
    dataSource: text("data_source").default("database").notNull(), // "database" | "google_sheets"

    // Full raw data for reference
    rawData: jsonb("raw_data"),

    // Metadata
    createdAt: timestamp("created_at").defaultNow().notNull()
  },
  table => [
    index("daily_snapshots_date_idx").on(table.snapshotDate),
    index("daily_snapshots_company_date_idx").on(table.companyId, table.snapshotDate),
    index("daily_snapshots_ticker_date_idx").on(table.ticker, table.snapshotDate)
  ]
)

export type InsertDailySnapshot = typeof dailySnapshots.$inferInsert
export type SelectDailySnapshot = typeof dailySnapshots.$inferSelect

// Stores aggregate market snapshots (total BTC holdings, avg mNAV, etc.)
export const marketSnapshots = pgTable(
  "market_snapshots",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    // Date of the snapshot
    snapshotDate: timestamp("snapshot_date").notNull().unique(),

    // BTC Price
    btcPrice: decimal("btc_price", { precision: 20, scale: 2 }).notNull(),

    // Aggregate Metrics
    totalBtcHoldings: decimal("total_btc_holdings", { precision: 20, scale: 8 }),
    totalMarketCapUsd: decimal("total_market_cap_usd", { precision: 20, scale: 2 }),
    totalEvUsd: decimal("total_ev_usd", { precision: 20, scale: 2 }),
    totalBtcNav: decimal("total_btc_nav", { precision: 20, scale: 2 }),

    // Average Metrics
    avgMNav: decimal("avg_m_nav", { precision: 10, scale: 4 }),
    medianMNav: decimal("median_m_nav", { precision: 10, scale: 4 }),
    weightedAvgMNav: decimal("weighted_avg_m_nav", { precision: 10, scale: 4 }),

    // Company count
    companyCount: decimal("company_count", { precision: 10, scale: 0 }),

    // Metadata
    createdAt: timestamp("created_at").defaultNow().notNull()
  },
  table => [index("market_snapshots_date_idx").on(table.snapshotDate)]
)

export type InsertMarketSnapshot = typeof marketSnapshots.$inferInsert
export type SelectMarketSnapshot = typeof marketSnapshots.$inferSelect
