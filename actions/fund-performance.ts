"use server"

import { db } from "@/db"
import { fundPerformanceSnapshots, fundStatistics } from "@/db/schema/fund-performance"
import { btcPrices } from "@/db/schema/btc-prices"
import { desc, gte, asc, lte, and } from "drizzle-orm"
import { google } from "googleapis"

const SPREADSHEET_ID = "1R5ZXjN3gDb7CVTrbUdqQU_HDLM2cFVUGS5CNynslAzE"
const LIVE_PORTFOLIO_SHEET = "Live Portfolio"

function getGoogleAuth() {
  const credentials = process.env.GOOGLE_SERVICE_ACCOUNT_KEY
  if (!credentials) throw new Error("GOOGLE_SERVICE_ACCOUNT_KEY not set")
  return new google.auth.GoogleAuth({
    credentials: JSON.parse(credentials),
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"]
  })
}

function parseNumber(val: string | undefined | null): number | null {
  if (!val || val === "n/a" || val === "#DIV/0!" || val === "#N/A" || val === "-") return null
  const cleaned = val.toString().replace(/[$€£¥₩฿₫R,\s%]/gi, "").replace(/[()]/g, "-").trim()
  if (cleaned === "" || cleaned === "-") return null
  const num = parseFloat(cleaned)
  return isNaN(num) ? null : num
}

export async function getFundPerformanceSnapshots(days: number = 365) {
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - days)
  startDate.setUTCHours(0, 0, 0, 0)

  const snapshots = await db
    .select()
    .from(fundPerformanceSnapshots)
    .where(gte(fundPerformanceSnapshots.snapshotDate, startDate))
    .orderBy(asc(fundPerformanceSnapshots.snapshotDate))

  return snapshots
}

export async function getLatestFundStatistics() {
  const stats = await db.query.fundStatistics.findFirst({
    orderBy: [desc(fundStatistics.snapshotDate)]
  })

  return stats
}

export async function getLatestFundPerformanceSnapshot() {
  const snapshot = await db.query.fundPerformanceSnapshots.findFirst({
    orderBy: [desc(fundPerformanceSnapshots.snapshotDate)]
  })

  return snapshot
}

// Helper to get BTC price for a given date
async function getBtcPriceForDate(date: Date): Promise<number | null> {
  const startOfDay = new Date(date)
  startOfDay.setUTCHours(0, 0, 0, 0)
  const endOfDay = new Date(date)
  endOfDay.setUTCHours(23, 59, 59, 999)

  const price = await db
    .select()
    .from(btcPrices)
    .where(
      and(
        gte(btcPrices.priceAt, startOfDay),
        lte(btcPrices.priceAt, endOfDay)
      )
    )
    .orderBy(desc(btcPrices.priceAt))
    .limit(1)

  if (price.length > 0 && price[0].priceUsd) {
    return parseFloat(price[0].priceUsd)
  }
  return null
}

export async function getFundVsBtcComparison(days: number = 365) {
  const snapshots = await getFundPerformanceSnapshots(days)

  if (snapshots.length === 0) return []

  // Filter to snapshots with monthly return data (either fund or BTC)
  const snapshotsWithReturns = snapshots.filter(s => s.netReturnMtd !== null || s.btcReturnMtd !== null)
  if (snapshotsWithReturns.length === 0) return []

  // Batch fetch all BTC prices for the date range in a single query
  const startDate = snapshotsWithReturns[0].snapshotDate
  const endDate = snapshotsWithReturns[snapshotsWithReturns.length - 1].snapshotDate

  const btcPricesData = await db
    .select()
    .from(btcPrices)
    .where(
      and(
        gte(btcPrices.priceAt, startDate),
        lte(btcPrices.priceAt, endDate)
      )
    )
    .orderBy(desc(btcPrices.priceAt))

  // Create a map of date -> BTC price (use the latest price for each day)
  const btcPriceMap = new Map<string, number>()
  for (const price of btcPricesData) {
    const dateKey = price.priceAt.toISOString().split('T')[0]
    if (!btcPriceMap.has(dateKey) && price.priceUsd) {
      btcPriceMap.set(dateKey, parseFloat(price.priceUsd))
    }
  }

  // Calculate cumulative returns by compounding monthly returns
  // Starting from 100 (index value), compound each month's return
  let fundCumulative = 100
  let btcCumulative = 100

  const result = []

  for (const snapshot of snapshotsWithReturns) {
    // Get BTC price from the map (look for closest date)
    const dateKey = snapshot.snapshotDate.toISOString().split('T')[0]
    let btcPrice = btcPriceMap.get(dateKey) ?? 0

    // If no exact match, try nearby dates (within 3 days)
    if (btcPrice === 0) {
      for (let i = 1; i <= 3; i++) {
        const prevDate = new Date(snapshot.snapshotDate)
        prevDate.setDate(prevDate.getDate() - i)
        const prevKey = prevDate.toISOString().split('T')[0]
        if (btcPriceMap.has(prevKey)) {
          btcPrice = btcPriceMap.get(prevKey)!
          break
        }
      }
    }

    // Compound the monthly returns
    const fundMtd = snapshot.netReturnMtd ? parseFloat(snapshot.netReturnMtd) : 0
    const btcMtd = snapshot.btcReturnMtd ? parseFloat(snapshot.btcReturnMtd) : 0

    fundCumulative = fundCumulative * (1 + fundMtd)
    btcCumulative = btcCumulative * (1 + btcMtd)

    result.push({
      date: snapshot.snapshotDate,
      fundNormalized: fundCumulative,
      btcNormalized: btcCumulative,
      fundAumUsd: fundCumulative * 1000, // Placeholder for tooltip display
      btcPrice,
      netReturnMtd: fundMtd,
      netReturnYtd: snapshot.netReturnYtd ? parseFloat(snapshot.netReturnYtd) : null,
      btcReturnMtd: btcMtd,
      btcReturnYtd: snapshot.btcReturnYtd ? parseFloat(snapshot.btcReturnYtd) : null
    })
  }

  return result
}

export async function getFundStatisticsHistory(days: number = 365) {
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - days)
  startDate.setUTCHours(0, 0, 0, 0)

  const stats = await db
    .select()
    .from(fundStatistics)
    .where(gte(fundStatistics.snapshotDate, startDate))
    .orderBy(asc(fundStatistics.snapshotDate))

  return stats
}

export async function getFundReturnsData(days: number = 365) {
  const snapshots = await getFundPerformanceSnapshots(days)

  // Filter to only snapshots with monthly returns
  return snapshots
    .filter(s => s.netReturnMtd !== null)
    .map(snapshot => ({
      date: snapshot.snapshotDate,
      netReturnMtd: snapshot.netReturnMtd ? parseFloat(snapshot.netReturnMtd) * 100 : null,
      btcReturnMtd: snapshot.btcReturnMtd ? parseFloat(snapshot.btcReturnMtd) * 100 : null,
      alpha: snapshot.netReturnMtd && snapshot.btcReturnMtd
        ? (parseFloat(snapshot.netReturnMtd) - parseFloat(snapshot.btcReturnMtd)) * 100
        : null
    }))
}

// Get summary stats for the latest fund snapshot (from historical + live data)
export async function getFundSummaryStats() {
  const latestSnapshot = await getLatestFundPerformanceSnapshot()

  // Calculate YTD return by compounding all MTD returns this year
  const now = new Date()
  const yearStart = new Date(Date.UTC(now.getUTCFullYear(), 0, 1))

  const ytdSnapshots = await db
    .select()
    .from(fundPerformanceSnapshots)
    .where(gte(fundPerformanceSnapshots.snapshotDate, yearStart))
    .orderBy(asc(fundPerformanceSnapshots.snapshotDate))

  // Check if we have a snapshot for the current month
  const currentMonth = now.getUTCMonth()
  const currentYear = now.getUTCFullYear()
  const hasCurrentMonthSnapshot = ytdSnapshots.some(s => {
    const snapDate = new Date(s.snapshotDate)
    return snapDate.getUTCMonth() === currentMonth && snapDate.getUTCFullYear() === currentYear
  })

  // Calculate cumulative YTD return (compound)
  let ytdReturn = 1
  for (const s of ytdSnapshots) {
    if (s.netReturnMtd) {
      ytdReturn *= (1 + parseFloat(s.netReturnMtd))
    }
  }

  // If current month is missing from database, try to get live MTD
  let liveMtdUsed = false
  if (!hasCurrentMonthSnapshot) {
    try {
      const liveStats = await getLiveFundStats()
      if (liveStats?.fundMtdReturn !== null && liveStats?.fundMtdReturn !== undefined) {
        ytdReturn *= (1 + liveStats.fundMtdReturn)
        liveMtdUsed = true
      }
    } catch (e) {
      console.error("Failed to fetch live MTD for YTD calculation:", e)
    }
  }

  ytdReturn = ytdReturn - 1

  return {
    fundAumUsd: latestSnapshot?.fundAumUsd ? parseFloat(latestSnapshot.fundAumUsd) : null,
    netReturnYtd: ytdReturn,
    lastSnapshotDate: latestSnapshot?.snapshotDate ?? null,
    monthsIncluded: ytdSnapshots.length + (liveMtdUsed ? 1 : 0),
    liveMtdUsed
  }
}

// Get historical summary stats from fund_statistics (Total Return, IRR, BTC Outperformance)
export async function getHistoricalSummaryStats() {
  const stats = await db.query.fundStatistics.findFirst({
    orderBy: [desc(fundStatistics.snapshotDate)]
  })

  if (!stats?.rawData) return null

  const rawData = stats.rawData as {
    totalReturnGross?: number | null
    totalReturnNet?: number | null
    irrGross?: number | null
    irrNet?: number | null
    ytdReturnGross?: number | null
    ytdReturnNet?: number | null
    btcOutperformanceGross?: number | null
    btcOutperformanceNet?: number | null
    lastUpdatedYear?: string | null
    fetchedAt?: string | null
  }

  return {
    totalReturnGross: rawData.totalReturnGross ?? null,
    totalReturnNet: rawData.totalReturnNet ?? null,
    irr: rawData.irrNet ?? null, // Use net IRR for display
    ytdReturn: rawData.ytdReturnNet ?? null, // Use net YTD for display
    btcOutperformance: rawData.btcOutperformanceNet ?? null, // Use net outperformance
    lastUpdatedYear: rawData.lastUpdatedYear ?? null,
    syncedAt: stats.syncedAt
  }
}

// Get LIVE fund stats directly from the Google Sheet (Live Portfolio tab, rows 1-4)
export async function getLiveFundStats() {
  try {
    const sheets = google.sheets({ version: "v4", auth: getGoogleAuth() })

    // Fetch rows 1-4 from Live Portfolio sheet (summary data)
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `'${LIVE_PORTFOLIO_SHEET}'!A1:K4`
    })

    const rows = response.data.values
    if (!rows || rows.length < 4) {
      console.error("Insufficient data from Live Portfolio sheet")
      return null
    }

    // Parse the header data from the screenshot:
    // Row 1: Live AUM | $138,921,796 | NAV AUM | $126,138,563 | [blank] | Fund MTD | 10.9%
    // Row 2: MTM AUM | $145,751,261 | NAV AUM | $126,138,563 | 15.5%
    // Row 3: Live BTC Price | $87,845 | NAV BTC Price | $88,264 | -0.5%
    // Row 4: Bitcoin AUM | 1,581.45 | [blank] | 5%

    const row1 = rows[0] || []
    const row2 = rows[1] || []
    const row3 = rows[2] || []
    const row4 = rows[3] || []

    // Extract values - column B has the primary values
    const liveAumUsd = parseNumber(row1[1])
    const navAumUsd = parseNumber(row1[3]) // Column D
    const fundMtd = parseNumber(row1[5]) // Column F - Fund MTD percentage

    const mtmAumUsd = parseNumber(row2[1])

    const liveBtcPrice = parseNumber(row3[1])
    const navBtcPrice = parseNumber(row3[3])

    const bitcoinAum = parseNumber(row4[1]) // BTC holdings

    // Fund MTD might be in different columns - try to find it
    // Looking for a percentage value around 10.9% in row 1
    let fundMtdReturn = fundMtd
    if (fundMtdReturn === null) {
      // Try other columns
      for (let i = 4; i < row1.length; i++) {
        const val = parseNumber(row1[i])
        if (val !== null && Math.abs(val) < 100) {
          // Likely a percentage
          fundMtdReturn = val
          break
        }
      }
    }

    return {
      liveAumUsd,
      navAumUsd,
      mtmAumUsd,
      fundMtdReturn: fundMtdReturn !== null ? fundMtdReturn / 100 : null, // Convert to decimal
      liveBtcPrice,
      navBtcPrice,
      bitcoinAum,
      fetchedAt: new Date()
    }
  } catch (error) {
    console.error("Error fetching live fund stats:", error)
    return null
  }
}
