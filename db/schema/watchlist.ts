import { index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core"
import { companies } from "./companies"
import { customers } from "./customers"

export const watchlist = pgTable(
  "watchlist",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    // User who owns this watchlist item
    userId: text("user_id")
      .notNull()
      .references(() => customers.userId, { onDelete: "cascade" }),

    // Company being watched
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),

    // Optional notes
    notes: text("notes"),

    // Display order
    sortOrder: text("sort_order").default("0"),

    // Timestamps
    createdAt: timestamp("created_at").defaultNow().notNull()
  },
  table => [
    index("watchlist_user_id_idx").on(table.userId),
    index("watchlist_user_company_idx").on(table.userId, table.companyId)
  ]
)

export type InsertWatchlistItem = typeof watchlist.$inferInsert
export type SelectWatchlistItem = typeof watchlist.$inferSelect
