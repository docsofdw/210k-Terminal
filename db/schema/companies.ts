import {
  boolean,
  decimal,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid
} from "drizzle-orm/pg-core"

export const companyStatus = pgEnum("company_status", ["active", "inactive"])

// Legacy currency enum for backward compatibility
export const currency = pgEnum("currency", [
  "USD", "CAD", "EUR", "GBP", "JPY", "HKD", "AUD", "BRL", "THB", "KRW",
  "TWD", "SGD", "CHF", "SEK", "NOK", "DKK", "PLN", "MXN", "ZAR", "INR"
])

export const companies = pgTable("companies", {
  id: uuid("id").defaultRandom().primaryKey(),

  // Basic Info (from Google Sheet)
  rank: decimal("rank", { precision: 10, scale: 0 }),
  name: text("name").notNull(),
  ticker: text("ticker").notNull().unique(),
  yahooTicker: text("yahoo_ticker"),
  exchange: text("exchange"),
  currencyCode: text("currency_code").default("USD"),
  conversionRate: decimal("conversion_rate", { precision: 18, scale: 8 }),

  // Legacy fields for backward compatibility
  tradingCurrency: currency("trading_currency").default("USD"),
  country: text("country"),
  sector: text("sector"),
  description: text("description"),

  // Company Details
  region: text("region"),
  subRegion: text("sub_region"),
  category: text("category"),
  website: text("website"),

  // Status
  status: companyStatus("status").default("active").notNull(),
  isTracked: boolean("is_tracked").default(true).notNull(),

  // Core Financial Data
  btcHoldings: decimal("btc_holdings", { precision: 20, scale: 8 }),
  price: decimal("price", { precision: 20, scale: 6 }),
  priceChange1d: decimal("price_change_1d", { precision: 10, scale: 4 }),
  marketCapUsd: decimal("market_cap_usd", { precision: 20, scale: 2 }),
  sharesOutstanding: decimal("shares_outstanding", { precision: 20, scale: 0 }),
  dilutedShares: decimal("diluted_shares", { precision: 20, scale: 0 }),
  dilutedMarketCapUsd: decimal("diluted_market_cap_usd", { precision: 20, scale: 2 }),

  // mNAV Metrics
  basicMNav: decimal("basic_mnav", { precision: 10, scale: 4 }),
  dilutedMNav: decimal("diluted_mnav", { precision: 10, scale: 4 }),
  priceAt1xDilutedMNav: decimal("price_at_1x_diluted_mnav", { precision: 20, scale: 6 }),

  // Enterprise Value & BTC NAV
  enterpriseValueUsd: decimal("enterprise_value_usd", { precision: 20, scale: 2 }),
  dilutedEvUsd: decimal("diluted_ev_usd", { precision: 20, scale: 2 }),
  btcNavUsd: decimal("btc_nav_usd", { precision: 20, scale: 2 }),
  debtUsd: decimal("debt_usd", { precision: 20, scale: 2 }),
  cashUsd: decimal("cash_usd", { precision: 20, scale: 2 }),
  preferredsUsd: decimal("preferreds_usd", { precision: 20, scale: 2 }),

  // Volume
  avgVolumeUsd: decimal("avg_volume_usd", { precision: 20, scale: 2 }),
  avgVolumeShares: decimal("avg_volume_shares", { precision: 20, scale: 0 }),

  // Price History & Technicals
  high1y: decimal("high_1y", { precision: 20, scale: 6 }),
  high1yDelta: decimal("high_1y_delta", { precision: 10, scale: 4 }),
  avg200d: decimal("avg_200d", { precision: 20, scale: 6 }),
  avg200dDelta: decimal("avg_200d_delta", { precision: 10, scale: 4 }),

  // Performance
  priceChange5d: decimal("price_change_5d", { precision: 10, scale: 4 }),
  priceChange1m: decimal("price_change_1m", { precision: 10, scale: 4 }),
  priceChangeYtd: decimal("price_change_ytd", { precision: 10, scale: 4 }),
  priceChange1y: decimal("price_change_1y", { precision: 10, scale: 4 }),

  // Insider Activity
  insiderBuySellRatio: decimal("insider_buy_sell_ratio", { precision: 10, scale: 4 }),

  // BTC Holdings Metadata
  btcHoldingsDate: timestamp("btc_holdings_date"),
  btcHoldingsSource: text("btc_holdings_source"), // "8-K", "Press Release", "Earnings", etc.
  btcHoldingsManual: decimal("btc_holdings_manual", { precision: 20, scale: 8 }), // Manual override value
  btcHoldingsUpdatedAt: timestamp("btc_holdings_updated_at"),

  // Data Source Tracking (for API migration)
  dataSource: text("data_source"), // "marketdata" | "twelvedata" | "sheets" | "manual"
  lastQuoteAt: timestamp("last_quote_at"), // When price/quote was last fetched from API
  lastFundamentalsAt: timestamp("last_fundamentals_at"), // When balance sheet was last fetched

  // Source tracking for fundamental data (allows manual overrides)
  cashSource: text("cash_source"), // "api" | "manual"
  debtSource: text("debt_source"), // "api" | "manual"

  // Sync Metadata (legacy Google Sheets sync)
  lastSyncedAt: timestamp("last_synced_at"),
  syncSource: text("sync_source"),

  // Data Provenance (for portfolio company scrapers)
  sharesSource: text("shares_source"), // "scraper:swc" | "scraper:lqwd" | "manual" | "api:yahoo" | "sheets"
  sharesLastVerified: timestamp("shares_last_verified"),
  dilutionSource: text("dilution_source"), // "scraper:mstr" | "scraper:moon" | "manual" | "sheets"
  dilutionLastVerified: timestamp("dilution_last_verified"),
  capitalStructureNotes: text("capital_structure_notes"), // Free text for complex situations

  // Metadata
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
})

export type InsertCompany = typeof companies.$inferInsert
export type SelectCompany = typeof companies.$inferSelect
