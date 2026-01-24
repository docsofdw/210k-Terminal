"use server"

import { db } from "@/db"
import { dailySnapshots, marketSnapshots } from "@/db/schema/daily-snapshots"
import { desc, eq, gte, lte, and, asc } from "drizzle-orm"

export async function getMarketSnapshots(days: number = 30) {
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - days)
  startDate.setUTCHours(0, 0, 0, 0)

  const snapshots = await db
    .select()
    .from(marketSnapshots)
    .where(gte(marketSnapshots.snapshotDate, startDate))
    .orderBy(asc(marketSnapshots.snapshotDate))

  return snapshots
}

export async function getCompanySnapshots(
  companyId: string,
  days: number = 30
) {
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - days)
  startDate.setUTCHours(0, 0, 0, 0)

  const snapshots = await db
    .select()
    .from(dailySnapshots)
    .where(
      and(
        eq(dailySnapshots.companyId, companyId),
        gte(dailySnapshots.snapshotDate, startDate)
      )
    )
    .orderBy(asc(dailySnapshots.snapshotDate))

  return snapshots
}

export async function getCompanySnapshotsByTicker(
  ticker: string,
  days: number = 30
) {
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - days)
  startDate.setUTCHours(0, 0, 0, 0)

  const snapshots = await db
    .select()
    .from(dailySnapshots)
    .where(
      and(
        eq(dailySnapshots.ticker, ticker),
        gte(dailySnapshots.snapshotDate, startDate)
      )
    )
    .orderBy(asc(dailySnapshots.snapshotDate))

  return snapshots
}

export async function getAllCompanySnapshotsForDate(date: Date) {
  const startOfDay = new Date(date)
  startOfDay.setUTCHours(0, 0, 0, 0)

  const endOfDay = new Date(date)
  endOfDay.setUTCHours(23, 59, 59, 999)

  const snapshots = await db
    .select()
    .from(dailySnapshots)
    .where(
      and(
        gte(dailySnapshots.snapshotDate, startOfDay),
        lte(dailySnapshots.snapshotDate, endOfDay)
      )
    )
    .orderBy(desc(dailySnapshots.mNav))

  return snapshots
}

export async function getLatestMarketSnapshot() {
  const snapshot = await db.query.marketSnapshots.findFirst({
    orderBy: [desc(marketSnapshots.snapshotDate)]
  })

  return snapshot
}

export async function getAvailableSnapshotDates() {
  const dates = await db
    .selectDistinct({ date: marketSnapshots.snapshotDate })
    .from(marketSnapshots)
    .orderBy(desc(marketSnapshots.snapshotDate))
    .limit(365)

  return dates.map(d => d.date)
}

export async function getMNavHistoryForAllCompanies(days: number = 30) {
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - days)
  startDate.setUTCHours(0, 0, 0, 0)

  const snapshots = await db
    .select({
      snapshotDate: dailySnapshots.snapshotDate,
      ticker: dailySnapshots.ticker,
      companyName: dailySnapshots.companyName,
      mNav: dailySnapshots.mNav,
      btcHoldings: dailySnapshots.btcHoldings
    })
    .from(dailySnapshots)
    .where(gte(dailySnapshots.snapshotDate, startDate))
    .orderBy(asc(dailySnapshots.snapshotDate))

  // Group by date
  const grouped = new Map<string, Map<string, { mNav: number | null; btcHoldings: number | null }>>()

  for (const snapshot of snapshots) {
    const dateKey = snapshot.snapshotDate.toISOString().split("T")[0]
    if (!grouped.has(dateKey)) {
      grouped.set(dateKey, new Map())
    }
    grouped.get(dateKey)!.set(snapshot.ticker, {
      mNav: snapshot.mNav ? parseFloat(snapshot.mNav) : null,
      btcHoldings: snapshot.btcHoldings ? parseFloat(snapshot.btcHoldings) : null
    })
  }

  return grouped
}

export async function getHoldingsHistoryForAllCompanies(days: number = 30) {
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - days)
  startDate.setUTCHours(0, 0, 0, 0)

  const snapshots = await db
    .select({
      snapshotDate: dailySnapshots.snapshotDate,
      ticker: dailySnapshots.ticker,
      companyName: dailySnapshots.companyName,
      btcHoldings: dailySnapshots.btcHoldings,
      btcNav: dailySnapshots.btcNav
    })
    .from(dailySnapshots)
    .where(gte(dailySnapshots.snapshotDate, startDate))
    .orderBy(asc(dailySnapshots.snapshotDate))

  return snapshots
}
