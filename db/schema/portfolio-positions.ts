import {
  decimal,
  pgTable,
  text,
  timestamp,
  uuid
} from "drizzle-orm/pg-core"
import { companies } from "./companies"
import { customers } from "./customers"

export const portfolioPositions = pgTable("portfolio_positions", {
  id: uuid("id").defaultRandom().primaryKey(),

  // Foreign keys
  userId: text("user_id").notNull().references(() => customers.userId),
  companyId: uuid("company_id").notNull().references(() => companies.id),

  // Position details
  shares: decimal("shares", { precision: 20, scale: 8 }).notNull(),
  averageCostBasis: decimal("average_cost_basis", { precision: 20, scale: 8 }), // In trading currency
  averageCostBasisUsd: decimal("average_cost_basis_usd", { precision: 20, scale: 2 }), // Converted to USD

  // Notes
  notes: text("notes"),

  // Metadata
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
})

export type InsertPortfolioPosition = typeof portfolioPositions.$inferInsert
export type SelectPortfolioPosition = typeof portfolioPositions.$inferSelect
