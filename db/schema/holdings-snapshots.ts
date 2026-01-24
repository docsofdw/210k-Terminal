import { decimal, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core"
import { companies } from "./companies"

export const holdingsSnapshots = pgTable("holdings_snapshots", {
  id: uuid("id").defaultRandom().primaryKey(),

  // Reference
  companyId: uuid("company_id")
    .references(() => companies.id, { onDelete: "cascade" })
    .notNull(),

  // Snapshot Data
  btcHoldings: decimal("btc_holdings", { precision: 20, scale: 8 }).notNull(),
  snapshotDate: timestamp("snapshot_date").notNull(),

  // Source & Notes
  source: text("source"),
  notes: text("notes"),

  // Audit
  createdBy: text("created_by"),
  createdAt: timestamp("created_at").defaultNow().notNull()
})

export type InsertHoldingsSnapshot = typeof holdingsSnapshots.$inferInsert
export type SelectHoldingsSnapshot = typeof holdingsSnapshots.$inferSelect
