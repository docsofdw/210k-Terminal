import {
  decimal,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid
} from "drizzle-orm/pg-core"
import { companies } from "./companies"

export const fundPositionCategory = pgEnum("fund_position_category", [
  "btc",
  "btc_equities",
  "cash",
  "debt",
  "other"
])

export const fundPositions = pgTable("fund_positions", {
  id: uuid("id").defaultRandom().primaryKey(),

  category: fundPositionCategory("category").notNull(),
  custodian: text("custodian").notNull(),
  positionName: text("position_name").notNull(),

  // Link to company if equity position
  companyId: uuid("company_id").references(() => companies.id),

  // Position details
  quantity: decimal("quantity", { precision: 20, scale: 8 }).notNull(),
  priceUsd: decimal("price_usd", { precision: 20, scale: 8 }),
  valueUsd: decimal("value_usd", { precision: 20, scale: 2 }).notNull(),
  valueBtc: decimal("value_btc", { precision: 20, scale: 8 }),
  weightPercent: decimal("weight_percent", { precision: 10, scale: 4 }),

  syncedAt: timestamp("synced_at").defaultNow().notNull()
})

export type InsertFundPosition = typeof fundPositions.$inferInsert
export type SelectFundPosition = typeof fundPositions.$inferSelect
