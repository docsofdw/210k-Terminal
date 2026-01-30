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

export interface ScreenerCompanyData {
  ticker: string
  companyName: string
  companyId: string
  currentMNav: number | null
  btcHoldings: number | null
  marketCapUsd: number | null
  avgMNav90d: number | null
  mNavDeviation: number | null
  mNavRank: number
  mNavChange7d: number | null
  mNavHistory: { date: string; mNav: number }[]
}

export async function getRelativeValueScreenerData(): Promise<ScreenerCompanyData[]> {
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - 90)
  startDate.setUTCHours(0, 0, 0, 0)

  const date7dAgo = new Date()
  date7dAgo.setDate(date7dAgo.getDate() - 7)
  date7dAgo.setUTCHours(0, 0, 0, 0)

  // Fetch all snapshots from last 90 days
  const snapshots = await db
    .select({
      snapshotDate: dailySnapshots.snapshotDate,
      companyId: dailySnapshots.companyId,
      ticker: dailySnapshots.ticker,
      companyName: dailySnapshots.companyName,
      mNav: dailySnapshots.mNav,
      btcHoldings: dailySnapshots.btcHoldings,
      marketCapUsd: dailySnapshots.marketCapUsd
    })
    .from(dailySnapshots)
    .where(gte(dailySnapshots.snapshotDate, startDate))
    .orderBy(asc(dailySnapshots.snapshotDate))

  // Group by company
  const companyMap = new Map<string, {
    ticker: string
    companyName: string
    companyId: string
    snapshots: {
      date: Date
      mNav: number | null
      btcHoldings: number | null
      marketCapUsd: number | null
    }[]
  }>()

  for (const s of snapshots) {
    if (!companyMap.has(s.ticker)) {
      companyMap.set(s.ticker, {
        ticker: s.ticker,
        companyName: s.companyName,
        companyId: s.companyId,
        snapshots: []
      })
    }
    companyMap.get(s.ticker)!.snapshots.push({
      date: s.snapshotDate,
      mNav: s.mNav ? parseFloat(s.mNav) : null,
      btcHoldings: s.btcHoldings ? parseFloat(s.btcHoldings) : null,
      marketCapUsd: s.marketCapUsd ? parseFloat(s.marketCapUsd) : null
    })
  }

  // Calculate metrics for each company
  const results: ScreenerCompanyData[] = []

  for (const [_, company] of companyMap) {
    const validSnapshots = company.snapshots.filter(s => s.mNav !== null && s.mNav > 0)

    if (validSnapshots.length === 0) continue

    // Get latest snapshot
    const latestSnapshot = validSnapshots[validSnapshots.length - 1]
    const currentMNav = latestSnapshot.mNav

    // Skip companies with negative or null current mNAV
    if (currentMNav === null || currentMNav <= 0) continue

    // Calculate 90-day average
    const avgMNav90d = validSnapshots.reduce((sum, s) => sum + (s.mNav || 0), 0) / validSnapshots.length

    // Calculate deviation from average
    const mNavDeviation = currentMNav && avgMNav90d
      ? ((currentMNav - avgMNav90d) / avgMNav90d) * 100
      : null

    // Find snapshot closest to 7 days ago
    let mNavChange7d: number | null = null
    for (let i = validSnapshots.length - 1; i >= 0; i--) {
      if (validSnapshots[i].date <= date7dAgo) {
        const mNav7dAgo = validSnapshots[i].mNav
        if (mNav7dAgo && currentMNav) {
          mNavChange7d = currentMNav - mNav7dAgo
        }
        break
      }
    }

    // Build history for sparkline (sample every few days to keep it small)
    const mNavHistory: { date: string; mNav: number }[] = []
    const step = Math.max(1, Math.floor(validSnapshots.length / 30))
    for (let i = 0; i < validSnapshots.length; i += step) {
      const s = validSnapshots[i]
      if (s.mNav !== null) {
        mNavHistory.push({
          date: s.date.toISOString().split("T")[0],
          mNav: s.mNav
        })
      }
    }
    // Always include the latest
    if (validSnapshots.length > 0 && latestSnapshot.mNav !== null) {
      const lastHistoryDate = mNavHistory[mNavHistory.length - 1]?.date
      const latestDate = latestSnapshot.date.toISOString().split("T")[0]
      if (lastHistoryDate !== latestDate) {
        mNavHistory.push({
          date: latestDate,
          mNav: latestSnapshot.mNav!
        })
      }
    }

    results.push({
      ticker: company.ticker,
      companyName: company.companyName,
      companyId: company.companyId,
      currentMNav,
      btcHoldings: latestSnapshot.btcHoldings,
      marketCapUsd: latestSnapshot.marketCapUsd,
      avgMNav90d,
      mNavDeviation,
      mNavRank: 0, // Will be set after sorting
      mNavChange7d,
      mNavHistory
    })
  }

  // Sort by current mNAV (ascending) and assign ranks
  results.sort((a, b) => {
    if (a.currentMNav === null) return 1
    if (b.currentMNav === null) return -1
    return a.currentMNav - b.currentMNav
  })

  results.forEach((r, i) => {
    r.mNavRank = i + 1
  })

  return results
}
