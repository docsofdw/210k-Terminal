import {
  boolean,
  decimal,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid
} from "drizzle-orm/pg-core"

export const companyStatus = pgEnum("company_status", ["active", "inactive"])
export const currency = pgEnum("currency", ["USD", "CAD", "EUR", "GBP", "JPY", "HKD", "AUD", "BRL", "THB", "KRW"])

export const companies = pgTable("companies", {
  id: uuid("id").defaultRandom().primaryKey(),

  // Basic Info
  name: text("name").notNull(),
  ticker: text("ticker").notNull().unique(),
  yahooTicker: text("yahoo_ticker").notNull(),
  exchange: text("exchange").notNull(),
  tradingCurrency: currency("trading_currency").default("USD").notNull(),

  // Company Details
  country: text("country").notNull(),
  sector: text("sector"),
  website: text("website"),
  description: text("description"),

  // Status
  status: companyStatus("status").default("active").notNull(),
  isTracked: boolean("is_tracked").default(true).notNull(),

  // Financial Data (manually maintained)
  sharesOutstanding: decimal("shares_outstanding", { precision: 20, scale: 0 }),
  cashUsd: decimal("cash_usd", { precision: 20, scale: 2 }),
  debtUsd: decimal("debt_usd", { precision: 20, scale: 2 }),
  preferredsUsd: decimal("preferreds_usd", { precision: 20, scale: 2 }),

  // BTC Holdings (manually maintained via snapshots)
  btcHoldings: decimal("btc_holdings", { precision: 20, scale: 8 }),
  btcHoldingsDate: timestamp("btc_holdings_date"),
  btcHoldingsSource: text("btc_holdings_source"),

  // Metadata
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
})

export type InsertCompany = typeof companies.$inferInsert
export type SelectCompany = typeof companies.$inferSelect
