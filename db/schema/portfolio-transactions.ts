import {
  decimal,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid
} from "drizzle-orm/pg-core"
import { companies } from "./companies"
import { customers } from "./customers"
import { portfolioPositions } from "./portfolio-positions"

export const transactionType = pgEnum("transaction_type", ["buy", "sell"])

export const portfolioTransactions = pgTable("portfolio_transactions", {
  id: uuid("id").defaultRandom().primaryKey(),

  // Foreign keys
  userId: text("user_id").notNull().references(() => customers.userId),
  companyId: uuid("company_id").notNull().references(() => companies.id),
  positionId: uuid("position_id").references(() => portfolioPositions.id),

  // Transaction details
  type: transactionType("type").notNull(),
  shares: decimal("shares", { precision: 20, scale: 8 }).notNull(),
  pricePerShare: decimal("price_per_share", { precision: 20, scale: 8 }).notNull(), // In trading currency
  pricePerShareUsd: decimal("price_per_share_usd", { precision: 20, scale: 2 }), // Converted to USD
  totalValue: decimal("total_value", { precision: 20, scale: 2 }).notNull(), // In trading currency
  totalValueUsd: decimal("total_value_usd", { precision: 20, scale: 2 }), // Converted to USD

  // BTC price at time of transaction (for BTC-denominated tracking)
  btcPriceUsd: decimal("btc_price_usd", { precision: 20, scale: 2 }),
  totalValueBtc: decimal("total_value_btc", { precision: 20, scale: 8 }),

  // Fees
  fees: decimal("fees", { precision: 20, scale: 2 }),
  feesUsd: decimal("fees_usd", { precision: 20, scale: 2 }),

  // Transaction date and notes
  transactionDate: timestamp("transaction_date").notNull(),
  notes: text("notes"),

  // Metadata
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
})

export type InsertPortfolioTransaction = typeof portfolioTransactions.$inferInsert
export type SelectPortfolioTransaction = typeof portfolioTransactions.$inferSelect
