import { decimal, index, pgTable, timestamp, uuid } from "drizzle-orm/pg-core"

export const btcPrices = pgTable(
  "btc_prices",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    // Price in USD
    priceUsd: decimal("price_usd", { precision: 20, scale: 2 }).notNull(),

    // 24h data
    high24h: decimal("high_24h", { precision: 20, scale: 2 }),
    low24h: decimal("low_24h", { precision: 20, scale: 2 }),
    volume24h: decimal("volume_24h", { precision: 20, scale: 2 }),
    change24h: decimal("change_24h", { precision: 10, scale: 4 }),

    // Market data
    marketCap: decimal("market_cap", { precision: 20, scale: 2 }),

    // Timestamp
    priceAt: timestamp("price_at").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull()
  },
  table => [index("btc_prices_price_at_idx").on(table.priceAt)]
)

export type InsertBtcPrice = typeof btcPrices.$inferInsert
export type SelectBtcPrice = typeof btcPrices.$inferSelect
