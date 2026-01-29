import { db } from "@/db"
import { fundPerformanceSnapshots, fundStatistics } from "@/db/schema/fund-performance"
import { eq, and, gte, lte } from "drizzle-orm"
import { google } from "googleapis"
import { NextRequest, NextResponse } from "next/server"

export const dynamic = "force-dynamic"
export const maxDuration = 60

const SPREADSHEET_ID = "1R5ZXjN3gDb7CVTrbUdqQU_HDLM2cFVUGS5CNynslAzE"

// Sheet names
const SHEETS = {
  HISTORICAL_PERFORMANCE: "Historical Performance",
  NET_RETURNS: "Net Returns",
  PORTFOLIO_STATISTICS: "Portfolio Statistics"
}

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

function parseDate(val: string | undefined | null): Date | null {
  if (!val) return null
  // Try MM/DD/YYYY format
  const parts = val.split("/")
  if (parts.length === 3) {
    const month = parseInt(parts[0]) - 1
    const day = parseInt(parts[1])
    const year = parseInt(parts[2])
    if (!isNaN(month) && !isNaN(day) && !isNaN(year)) {
      return new Date(Date.UTC(year, month, day))
    }
  }
  // Try standard date parsing
  const date = new Date(val)
  if (!isNaN(date.getTime())) return date
  return null
}

// Month name to number mapping for Net Returns sheet
const MONTH_MAP: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11
}

function parseMonthYear(header: string): { month: number; year: number } | null {
  const match = header?.toLowerCase().match(/^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\s*(\d{2})$/)
  if (!match) return null
  const month = MONTH_MAP[match[1]]
  const year = 2000 + parseInt(match[2])
  return { month, year }
}

/**
 * Sync Historical Performance sheet - has fund AUM and monthly % change
 * Structure:
 * Row 8: Headers [Date, Gross Balance, % change, cumulative pre-fee return, ...]
 * Row 9+: Data [9/17/2019, $254,747.17, 0.000%, 0.00%, ...]
 */
async function syncHistoricalPerformance(sheets: ReturnType<typeof google.sheets>) {
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `'${SHEETS.HISTORICAL_PERFORMANCE}'!A9:L200`
  })

  const rows = response.data.values
  if (!rows || rows.length < 2) {
    return { sheet: SHEETS.HISTORICAL_PERFORMANCE, synced: 0, error: "Insufficient data" }
  }

  // First row should be header
  const headers = rows[0].map(h => h?.toString().toLowerCase() || "")

  // Find column indices
  const dateCol = headers.findIndex(h => h.includes("date"))
  const balanceCol = headers.findIndex(h => h.includes("balance") || h.includes("gross"))
  const changeCol = headers.findIndex(h => h.includes("% change") || h.includes("change"))

  if (dateCol === -1) {
    return { sheet: SHEETS.HISTORICAL_PERFORMANCE, synced: 0, error: "Date column not found" }
  }

  let synced = 0
  const now = new Date()

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i]
    if (!row?.length) continue

    const dateVal = parseDate(row[dateCol])
    if (!dateVal) continue

    const fundAumUsd = balanceCol !== -1 ? parseNumber(row[balanceCol]) : null
    const monthlyChange = changeCol !== -1 ? parseNumber(row[changeCol]) : null

    // Skip rows without meaningful data
    if (fundAumUsd === null && monthlyChange === null) continue

    // Normalize date to start of day UTC
    const snapshotDate = new Date(Date.UTC(
      dateVal.getUTCFullYear(),
      dateVal.getUTCMonth(),
      dateVal.getUTCDate()
    ))

    const snapshot = {
      snapshotDate,
      fundAumUsd: fundAumUsd?.toString() ?? null,
      fundAumBtc: null, // Will calculate if we add BTC price lookup
      btcPriceAtSnapshot: null,
      netReturnMtd: monthlyChange !== null ? (monthlyChange / 100).toString() : null,
      netReturnYtd: null,
      netReturnItd: null,
      btcReturnMtd: null,
      btcReturnYtd: null,
      btcReturnItd: null,
      sourceSheet: SHEETS.HISTORICAL_PERFORMANCE,
      rawData: Object.fromEntries(headers.map((h, idx) => [h || `col${idx}`, row[idx] ?? null])),
      syncedAt: now
    }

    // Upsert based on snapshotDate
    const existing = await db.select()
      .from(fundPerformanceSnapshots)
      .where(eq(fundPerformanceSnapshots.snapshotDate, snapshotDate))
      .limit(1)

    if (existing.length > 0) {
      // Update existing - merge data (preserve existing returns if new values are null)
      const updates: Record<string, unknown> = { ...snapshot }
      if (!snapshot.netReturnMtd && existing[0].netReturnMtd) {
        updates.netReturnMtd = existing[0].netReturnMtd
      }
      if (!snapshot.btcReturnMtd && existing[0].btcReturnMtd) {
        updates.btcReturnMtd = existing[0].btcReturnMtd
      }
      await db.update(fundPerformanceSnapshots)
        .set(updates)
        .where(eq(fundPerformanceSnapshots.id, existing[0].id))
    } else {
      await db.insert(fundPerformanceSnapshots).values(snapshot)
    }
    synced++
  }

  return { sheet: SHEETS.HISTORICAL_PERFORMANCE, synced }
}

/**
 * Sync Net Returns sheet - has monthly net returns in pivoted format
 * Structure:
 * Row 2: Year header [, 2025, Jan 25, Feb 25, ...]
 * Row 3: Fund returns [, 210k Capital LP, 22.16, 4.81, ...]
 */
async function syncNetReturns(sheets: ReturnType<typeof google.sheets>) {
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `'${SHEETS.NET_RETURNS}'!A1:P50`
  })

  const rows = response.data.values
  if (!rows || rows.length < 3) {
    return { sheet: SHEETS.NET_RETURNS, synced: 0, error: "Insufficient data" }
  }

  let synced = 0
  const now = new Date()

  // Process rows - look for year header rows followed by fund data rows
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    if (!row?.length) continue

    // Check if this is a year header row (contains month headers like "Jan 25")
    const col1 = row[1]?.toString().trim()
    if (!col1 || !(/^\d{4}$/.test(col1))) continue

    const headerRow = row
    const fundRow = rows[i + 1]

    if (!fundRow || !fundRow[1]?.toString().toLowerCase().includes("210k")) continue

    // Parse each month column
    for (let col = 2; col < headerRow.length - 1; col++) {
      const monthHeader = headerRow[col]?.toString().trim()
      const parsed = parseMonthYear(monthHeader)
      if (!parsed) continue

      const returnVal = parseNumber(fundRow[col])
      if (returnVal === null) continue

      // Create date for end of month
      const snapshotDate = new Date(Date.UTC(parsed.year, parsed.month + 1, 0))

      // Check if we already have data for this date from Historical Performance
      const existing = await db.select()
        .from(fundPerformanceSnapshots)
        .where(eq(fundPerformanceSnapshots.snapshotDate, snapshotDate))
        .limit(1)

      if (existing.length > 0) {
        // Update with net return data if not already set
        if (!existing[0].netReturnMtd) {
          await db.update(fundPerformanceSnapshots)
            .set({
              netReturnMtd: (returnVal / 100).toString(),
              syncedAt: now
            })
            .where(eq(fundPerformanceSnapshots.id, existing[0].id))
          synced++
        }
      } else {
        // Insert new record with just net return
        await db.insert(fundPerformanceSnapshots).values({
          snapshotDate,
          fundAumUsd: null,
          fundAumBtc: null,
          btcPriceAtSnapshot: null,
          netReturnMtd: (returnVal / 100).toString(),
          netReturnYtd: null,
          netReturnItd: null,
          btcReturnMtd: null,
          btcReturnYtd: null,
          btcReturnItd: null,
          sourceSheet: SHEETS.NET_RETURNS,
          rawData: { month: monthHeader, return: fundRow[col] },
          syncedAt: now
        })
        synced++
      }
    }
  }

  return { sheet: SHEETS.NET_RETURNS, synced }
}

/**
 * Sync Portfolio Statistics sheet - has monthly fund and BTC returns
 * Structure:
 * Column A: Date (monthly, end of month)
 * Column B: 210k Net Monthly Returns (%)
 * Column C: BTC Return (%)
 * Also has calculated stats at the bottom: Sharpe, Sortino, Alpha, Beta, Volatility, Correlation
 */
async function syncPortfolioStatistics(sheets: ReturnType<typeof google.sheets>) {
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `'${SHEETS.PORTFOLIO_STATISTICS}'!A:C`
  })

  const rows = response.data.values
  if (!rows || rows.length < 2) {
    return { sheet: SHEETS.PORTFOLIO_STATISTICS, synced: 0, error: "Insufficient data" }
  }

  let synced = 0
  const now = new Date()

  // Process each row - skip header row
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i]
    if (!row?.length) continue

    // Column A: Date, Column B: Fund Return, Column C: BTC Return
    const dateVal = parseDate(row[0])
    if (!dateVal) continue

    const fundReturn = parseNumber(row[1])
    const btcReturn = parseNumber(row[2])

    // Skip rows without meaningful data
    if (fundReturn === null && btcReturn === null) continue

    // Normalize date to end of month UTC
    const snapshotDate = new Date(Date.UTC(
      dateVal.getUTCFullYear(),
      dateVal.getUTCMonth() + 1,
      0 // Last day of month
    ))

    // Check if we already have data for this date
    const existing = await db.select()
      .from(fundPerformanceSnapshots)
      .where(eq(fundPerformanceSnapshots.snapshotDate, snapshotDate))
      .limit(1)

    if (existing.length > 0) {
      // Update with monthly return data
      await db.update(fundPerformanceSnapshots)
        .set({
          netReturnMtd: fundReturn !== null ? (fundReturn / 100).toString() : existing[0].netReturnMtd,
          btcReturnMtd: btcReturn !== null ? (btcReturn / 100).toString() : existing[0].btcReturnMtd,
          sourceSheet: SHEETS.PORTFOLIO_STATISTICS,
          syncedAt: now
        })
        .where(eq(fundPerformanceSnapshots.id, existing[0].id))
      synced++
    } else {
      // Insert new record
      await db.insert(fundPerformanceSnapshots).values({
        snapshotDate,
        fundAumUsd: null,
        fundAumBtc: null,
        btcPriceAtSnapshot: null,
        netReturnMtd: fundReturn !== null ? (fundReturn / 100).toString() : null,
        netReturnYtd: null,
        netReturnItd: null,
        btcReturnMtd: btcReturn !== null ? (btcReturn / 100).toString() : null,
        btcReturnYtd: null,
        btcReturnItd: null,
        sourceSheet: SHEETS.PORTFOLIO_STATISTICS,
        rawData: { date: row[0], fundReturn: row[1], btcReturn: row[2] },
        syncedAt: now
      })
      synced++
    }
  }

  return { sheet: SHEETS.PORTFOLIO_STATISTICS, synced }
}

/**
 * Sync Historical Performance summary stats (rows 1-7)
 * Has key performance metrics: Total Return, IRR, YTD, BTC Outperformance
 * Structure (as of 2024):
 * Row 1: ["Fee Assumptions","","","Returns (As of 12/31/24)","Gross","Net"]
 * Row 2: ["Mgmt Fee","2%","","Total Return Since Inception","1027.9%","795.7%"]
 * Row 3: ["Perf Fee","20%","","IRR","58.2%","51.4%"]
 * Row 4: ["","","","2024 YTD Return","201.1%","165.2%"]
 * Row 5: ["","","","TTM Return","201.1%","165.2%"]
 * Row 6: ["","","","2024 BTC Outperformance","81.7%","45.8%"]
 * Row 7: ["","","","TTM BTC Outperformance","81.7%","45.8%"]
 */
async function syncHistoricalSummary(sheets: ReturnType<typeof google.sheets>) {
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `'${SHEETS.HISTORICAL_PERFORMANCE}'!A1:G7`
  })

  const rows = response.data.values
  if (!rows || rows.length < 5) {
    return { sheet: `${SHEETS.HISTORICAL_PERFORMANCE} (summary)`, synced: 0, error: "Insufficient summary data" }
  }

  const now = new Date()

  // Parse summary stats - labels are in Column D (index 3), values in E (gross) and F (net)
  let totalReturnGross: number | null = null
  let totalReturnNet: number | null = null
  let irrGross: number | null = null
  let irrNet: number | null = null
  let ytdReturnGross: number | null = null
  let ytdReturnNet: number | null = null
  let btcOutperformanceGross: number | null = null
  let btcOutperformanceNet: number | null = null
  let lastUpdatedYear: string | null = null

  // Check header row for year info (e.g., "Returns (As of 12/31/24)")
  const headerRow = rows[0]
  if (headerRow && headerRow[3]) {
    const yearMatch = headerRow[3].toString().match(/(\d{2})\/(\d{2})\/(\d{2})/)
    if (yearMatch) {
      lastUpdatedYear = `20${yearMatch[3]}`
    }
  }

  for (const row of rows) {
    if (!row?.length || row.length < 6) continue
    const label = row[3]?.toString().toLowerCase() || ""

    if (label.includes("total return") && label.includes("inception")) {
      totalReturnGross = parseNumber(row[4])
      totalReturnNet = parseNumber(row[5])
    } else if (label.includes("irr") && !label.includes("outperformance")) {
      irrGross = parseNumber(row[4])
      irrNet = parseNumber(row[5])
    } else if (label.includes("ytd") && !label.includes("btc") && !label.includes("outperformance")) {
      ytdReturnGross = parseNumber(row[4])
      ytdReturnNet = parseNumber(row[5])
      // Extract year from label if present (e.g., "2024 YTD Return")
      const yearMatch = label.match(/(\d{4})/)
      if (yearMatch && !lastUpdatedYear) {
        lastUpdatedYear = yearMatch[1]
      }
    } else if (label.includes("btc outperformance") && !label.includes("ttm")) {
      btcOutperformanceGross = parseNumber(row[4])
      btcOutperformanceNet = parseNumber(row[5])
    }
  }

  // Store in fund_statistics table
  const snapshotDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))

  const statsData = {
    snapshotDate,
    btcAllocation: null,
    equitiesAllocation: null,
    cashAllocation: null,
    otherAllocation: null,
    volatility: null,
    sharpeRatio: null,
    maxDrawdown: null,
    btcCorrelation: null,
    rawData: {
      source: "Historical Performance Summary (Rows 1-7)",
      totalReturnGross,
      totalReturnNet,
      irrGross,
      irrNet,
      ytdReturnGross,
      ytdReturnNet,
      btcOutperformanceGross,
      btcOutperformanceNet,
      lastUpdatedYear,
      fetchedAt: now.toISOString()
    },
    syncedAt: now
  }

  // Upsert based on current month
  const existing = await db.select()
    .from(fundStatistics)
    .where(eq(fundStatistics.snapshotDate, snapshotDate))
    .limit(1)

  if (existing.length > 0) {
    await db.update(fundStatistics)
      .set(statsData)
      .where(eq(fundStatistics.id, existing[0].id))
  } else {
    await db.insert(fundStatistics).values(statsData)
  }

  return {
    sheet: `${SHEETS.HISTORICAL_PERFORMANCE} (summary)`,
    synced: 1,
    stats: { totalReturnGross, totalReturnNet, irrNet, ytdReturnNet, btcOutperformanceNet }
  }
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const sheets = google.sheets({ version: "v4", auth: getGoogleAuth() })

    // Sync Portfolio Statistics (primary source for monthly returns)
    const portfolioResult = await syncPortfolioStatistics(sheets).catch(e => ({
      sheet: SHEETS.PORTFOLIO_STATISTICS,
      synced: 0,
      error: e.message
    }))

    // Sync Historical Performance summary stats (rows 1-7)
    const summaryResult = await syncHistoricalSummary(sheets).catch(e => ({
      sheet: `${SHEETS.HISTORICAL_PERFORMANCE} (summary)`,
      synced: 0,
      error: e.message
    }))

    // Sync Historical Performance (has AUM data, for reference)
    const histResult = await syncHistoricalPerformance(sheets).catch(e => ({
      sheet: SHEETS.HISTORICAL_PERFORMANCE,
      synced: 0,
      error: e.message
    }))

    // Then sync Net Returns (backup net returns data)
    const netResult = await syncNetReturns(sheets).catch(e => ({
      sheet: SHEETS.NET_RETURNS,
      synced: 0,
      error: e.message
    }))

    const totalSynced = (portfolioResult.synced || 0) + (summaryResult.synced || 0) + (histResult.synced || 0) + (netResult.synced || 0)

    return NextResponse.json({
      success: true,
      results: [portfolioResult, summaryResult, histResult, netResult],
      totalSynced,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error("Fund performance sync error:", error)
    return NextResponse.json({
      error: "Sync failed",
      details: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 })
  }
}
