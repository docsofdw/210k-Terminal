import { decimal, jsonb, pgTable, text, timestamp, uuid, index } from "drizzle-orm/pg-core"

export const fundPerformanceSnapshots = pgTable(
  "fund_performance_snapshots",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    // Snapshot identification
    snapshotDate: timestamp("snapshot_date").notNull(),

    // Fund AUM data
    fundAumUsd: decimal("fund_aum_usd", { precision: 20, scale: 2 }),
    fundAumBtc: decimal("fund_aum_btc", { precision: 20, scale: 8 }),
    btcPriceAtSnapshot: decimal("btc_price_at_snapshot", { precision: 20, scale: 2 }),

    // Net returns
    netReturnMtd: decimal("net_return_mtd", { precision: 10, scale: 6 }),
    netReturnYtd: decimal("net_return_ytd", { precision: 10, scale: 6 }),
    netReturnItd: decimal("net_return_itd", { precision: 10, scale: 6 }),

    // BTC benchmark returns
    btcReturnMtd: decimal("btc_return_mtd", { precision: 10, scale: 6 }),
    btcReturnYtd: decimal("btc_return_ytd", { precision: 10, scale: 6 }),
    btcReturnItd: decimal("btc_return_itd", { precision: 10, scale: 6 }),

    // Source tracking
    sourceSheet: text("source_sheet"),
    rawData: jsonb("raw_data"),

    // Audit
    syncedAt: timestamp("synced_at").defaultNow().notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull()
  },
  (table) => [
    index("fund_performance_snapshots_date_idx").on(table.snapshotDate)
  ]
)

export const fundStatistics = pgTable(
  "fund_statistics",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    // Snapshot identification
    snapshotDate: timestamp("snapshot_date").notNull(),

    // Allocation percentages
    btcAllocation: decimal("btc_allocation", { precision: 10, scale: 4 }),
    equitiesAllocation: decimal("equities_allocation", { precision: 10, scale: 4 }),
    cashAllocation: decimal("cash_allocation", { precision: 10, scale: 4 }),
    otherAllocation: decimal("other_allocation", { precision: 10, scale: 4 }),

    // Risk metrics
    volatility: decimal("volatility", { precision: 10, scale: 6 }),
    sharpeRatio: decimal("sharpe_ratio", { precision: 10, scale: 4 }),
    maxDrawdown: decimal("max_drawdown", { precision: 10, scale: 6 }),
    btcCorrelation: decimal("btc_correlation", { precision: 10, scale: 4 }),

    // Source tracking
    rawData: jsonb("raw_data"),

    // Audit
    syncedAt: timestamp("synced_at").defaultNow().notNull()
  },
  (table) => [index("fund_statistics_date_idx").on(table.snapshotDate)]
)

export type InsertFundPerformanceSnapshot = typeof fundPerformanceSnapshots.$inferInsert
export type SelectFundPerformanceSnapshot = typeof fundPerformanceSnapshots.$inferSelect

export type InsertFundStatistics = typeof fundStatistics.$inferInsert
export type SelectFundStatistics = typeof fundStatistics.$inferSelect
