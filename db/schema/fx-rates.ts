import { decimal, index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core"

export const fxRates = pgTable(
  "fx_rates",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    // Currency pair (e.g., CAD, EUR, GBP - all relative to USD)
    currency: text("currency").notNull(),

    // Rate to USD (1 USD = X currency, so USD/CAD might be 1.35)
    rateToUsd: decimal("rate_to_usd", { precision: 20, scale: 6 }).notNull(),

    // Inverse rate (1 currency = X USD)
    rateFromUsd: decimal("rate_from_usd", { precision: 20, scale: 6 }).notNull(),

    // Timestamp
    rateAt: timestamp("rate_at").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull()
  },
  table => [
    index("fx_rates_currency_rate_at_idx").on(table.currency, table.rateAt)
  ]
)

export type InsertFxRate = typeof fxRates.$inferInsert
export type SelectFxRate = typeof fxRates.$inferSelect
