import { decimal, index, pgTable, timestamp, uuid } from "drizzle-orm/pg-core"
import { companies } from "./companies"

export const stockPrices = pgTable(
  "stock_prices",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    // Reference
    companyId: uuid("company_id")
      .references(() => companies.id, { onDelete: "cascade" })
      .notNull(),

    // Price Data (in trading currency)
    price: decimal("price", { precision: 20, scale: 4 }).notNull(),
    open: decimal("open", { precision: 20, scale: 4 }),
    high: decimal("high", { precision: 20, scale: 4 }),
    low: decimal("low", { precision: 20, scale: 4 }),
    close: decimal("close", { precision: 20, scale: 4 }),
    volume: decimal("volume", { precision: 20, scale: 0 }),

    // Market Cap (calculated or fetched)
    marketCapUsd: decimal("market_cap_usd", { precision: 20, scale: 2 }),

    // Timestamp
    priceAt: timestamp("price_at").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull()
  },
  table => [
    index("stock_prices_company_price_at_idx").on(table.companyId, table.priceAt)
  ]
)

export type InsertStockPrice = typeof stockPrices.$inferInsert
export type SelectStockPrice = typeof stockPrices.$inferSelect
