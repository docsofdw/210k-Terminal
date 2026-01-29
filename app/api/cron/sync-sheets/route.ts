import { db } from "@/db"
import { companies } from "@/db/schema/companies"
import { eq } from "drizzle-orm"
import { google } from "googleapis"
import { NextRequest, NextResponse } from "next/server"

export const dynamic = "force-dynamic"
export const maxDuration = 60

// BTCTCs Master Sheet configuration
const SPREADSHEET_ID = "1_whntepzncCFsn-K1oyL5Epqh5D6mauAOnb_Zs7svkk"
const DASHBOARD_SHEET = "Dashboard"

// Critical fields that should have data for a valid sync
const CRITICAL_FIELDS = [
  "price",
  "marketCapUsd",
  "dilutedMNav",
  "enterpriseValueUsd",
  "btcNavUsd"
] as const

// Threshold for anomaly detection (if more than 30% of critical fields are missing, warn)
const ANOMALY_THRESHOLD = 0.3

function getGoogleAuth() {
  const credentials = process.env.GOOGLE_SERVICE_ACCOUNT_KEY
  if (!credentials) {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_KEY not set")
  }

  const parsed = JSON.parse(credentials)
  return new google.auth.GoogleAuth({
    credentials: parsed,
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"]
  })
}

function parseNumber(val: string | undefined | null): string | null {
  if (val === undefined || val === null || val === "") return null
  const cleaned = val
    .toString()
    .replace(/[$€£¥₩฿,\s%]/g, "")
    .replace(/[()]/g, "-")
    .trim()

  if (cleaned === "" || cleaned === "-" || cleaned === "N/A") return null

  const num = parseFloat(cleaned)
  return isNaN(num) ? null : num.toString()
}

function parseString(val: string | undefined | null): string | null {
  if (val === undefined || val === null) return null
  const str = val.toString().trim()
  return str === "" || str === "N/A" ? null : str
}

// Helper to remove null/undefined values from an object (preserves existing DB values)
function filterNullValues<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const filtered: Partial<T> = {}
  for (const [key, value] of Object.entries(obj)) {
    if (value !== null && value !== undefined) {
      filtered[key as keyof T] = value as T[keyof T]
    }
  }
  return filtered
}

// Check if a company row has critical data issues
function checkDataQuality(data: Record<string, unknown>): {
  missingCritical: string[]
  qualityScore: number
} {
  const missingCritical: string[] = []
  for (const field of CRITICAL_FIELDS) {
    if (data[field] === null || data[field] === undefined) {
      missingCritical.push(field)
    }
  }
  const qualityScore = 1 - missingCritical.length / CRITICAL_FIELDS.length
  return { missingCritical, qualityScore }
}

export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const auth = getGoogleAuth()
    const sheets = google.sheets({ version: "v4", auth })

    // Fetch Dashboard sheet data
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `'${DASHBOARD_SHEET}'!A:AJ`
    })

    const rows = response.data.values
    if (!rows || rows.length < 2) {
      return NextResponse.json(
        { error: "No data found in Dashboard sheet" },
        { status: 500 }
      )
    }

    // First row is headers
    const headers = rows[0].map((h: string) => h?.toString().toLowerCase().trim() || "")

    // Build column index map
    const colIndex = (searchTerms: string[]): number => {
      for (const term of searchTerms) {
        const idx = headers.findIndex((h: string) =>
          h === term.toLowerCase() || h.includes(term.toLowerCase())
        )
        if (idx !== -1) return idx
      }
      return -1
    }

    // Map columns
    const cols = {
      rank: colIndex(["rank"]),
      name: colIndex(["company name", "name"]),
      ticker: colIndex(["ticker"]),
      btcHoldings: colIndex(["btc holdings", "btc"]),
      basicMNav: colIndex(["basic mnav"]),
      dilutedMNav: colIndex(["diluted mnav"]),
      price: colIndex(["price"]),
      priceChange1d: colIndex(["1d change", "1d"]),
      priceAt1xDilutedMNav: colIndex(["1x d. mnav price", "1x diluted mnav", "1x d."]),
      enterpriseValueUsd: colIndex(["enterprise value (usd)", "enterprise value", "ev"]),
      avgVolumeUsd: colIndex(["avg volume (usd)", "avg volume usd"]),
      btcNavUsd: colIndex(["btc nav (usd)", "btc nav"]),
      debtUsd: colIndex(["total debt", "debt"]),
      high1y: colIndex(["1y high"]),
      high1yDelta: colIndex(["1y high delta"]),
      avg200d: colIndex(["200d avg"]),
      avg200dDelta: colIndex(["200d avg delta"]),
      insiderBuySellRatio: colIndex(["insider buy/sell ratio", "insider"]),
      cashUsd: colIndex(["cash and equiv", "cash"]),
      marketCapUsd: colIndex(["market cap"]),
      sharesOutstanding: colIndex(["shares outstanding"]),
      dilutedShares: colIndex(["diluted shares"]),
      dilutedMarketCapUsd: colIndex(["diluted market cap"]),
      dilutedEvUsd: colIndex(["diluted ev (usd)", "diluted ev"]),
      exchange: colIndex(["exchange"]),
      avgVolumeShares: colIndex(["avg volume (shares)"]),
      priceChange5d: colIndex(["5d"]),
      priceChange1m: colIndex(["1m"]),
      priceChangeYtd: colIndex(["ytd"]),
      priceChange1y: colIndex(["1y"]),
      currencyCode: colIndex(["currency code", "currency"]),
      conversionRate: colIndex(["conversion rate"]),
      region: colIndex(["region"]),
      subRegion: colIndex(["sub-region", "subregion"]),
      category: colIndex(["category"])
    }

    let updated = 0
    let inserted = 0
    let skipped = 0
    let lowQualityRows = 0
    let totalQualityScore = 0
    const warnings: string[] = []

    // Process each data row (skip header)
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i]
      if (!row) continue

      const ticker = parseString(row[cols.ticker])
      const name = parseString(row[cols.name])

      if (!ticker || !name) {
        skipped++
        continue
      }

      // Prepare update data
      const updateData = {
        rank: parseNumber(row[cols.rank]),
        name,
        yahooTicker: ticker,
        exchange: parseString(row[cols.exchange]),
        currencyCode: parseString(row[cols.currencyCode]) || "USD",
        conversionRate: parseNumber(row[cols.conversionRate]),
        region: parseString(row[cols.region]),
        subRegion: parseString(row[cols.subRegion]),
        category: parseString(row[cols.category]),
        btcHoldings: parseNumber(row[cols.btcHoldings]),
        price: parseNumber(row[cols.price]),
        priceChange1d: parseNumber(row[cols.priceChange1d]),
        marketCapUsd: parseNumber(row[cols.marketCapUsd]),
        sharesOutstanding: parseNumber(row[cols.sharesOutstanding]),
        dilutedShares: parseNumber(row[cols.dilutedShares]),
        dilutedMarketCapUsd: parseNumber(row[cols.dilutedMarketCapUsd]),
        basicMNav: parseNumber(row[cols.basicMNav]),
        dilutedMNav: parseNumber(row[cols.dilutedMNav]),
        priceAt1xDilutedMNav: parseNumber(row[cols.priceAt1xDilutedMNav]),
        enterpriseValueUsd: parseNumber(row[cols.enterpriseValueUsd]),
        dilutedEvUsd: parseNumber(row[cols.dilutedEvUsd]),
        btcNavUsd: parseNumber(row[cols.btcNavUsd]),
        debtUsd: parseNumber(row[cols.debtUsd]),
        cashUsd: parseNumber(row[cols.cashUsd]),
        avgVolumeUsd: parseNumber(row[cols.avgVolumeUsd]),
        avgVolumeShares: parseNumber(row[cols.avgVolumeShares]),
        high1y: parseNumber(row[cols.high1y]),
        high1yDelta: parseNumber(row[cols.high1yDelta]),
        avg200d: parseNumber(row[cols.avg200d]),
        avg200dDelta: parseNumber(row[cols.avg200dDelta]),
        priceChange5d: parseNumber(row[cols.priceChange5d]),
        priceChange1m: parseNumber(row[cols.priceChange1m]),
        priceChangeYtd: parseNumber(row[cols.priceChangeYtd]),
        priceChange1y: parseNumber(row[cols.priceChange1y]),
        insiderBuySellRatio: parseNumber(row[cols.insiderBuySellRatio]),
        lastSyncedAt: new Date(),
        syncSource: "Google Sheets cron sync",
        updatedAt: new Date()
      }

      // Check data quality for this row
      const { missingCritical, qualityScore } = checkDataQuality(updateData)
      totalQualityScore += qualityScore

      if (qualityScore < 1 - ANOMALY_THRESHOLD) {
        lowQualityRows++
        // Log warning for major companies missing critical data
        if (["MSTR", "MARA", "COIN", "RIOT"].includes(ticker)) {
          warnings.push(`${ticker} missing critical fields: ${missingCritical.join(", ")}`)
        }
      }

      // Try to update existing company by ticker
      const [existing] = await db
        .select()
        .from(companies)
        .where(eq(companies.ticker, ticker))
        .limit(1)

      if (existing) {
        // PROTECTION: Only update fields that have valid values
        // This prevents null values from overwriting good existing data
        const safeUpdateData = filterNullValues(updateData)

        // Always update these metadata fields
        safeUpdateData.lastSyncedAt = new Date()
        safeUpdateData.syncSource = "Google Sheets cron sync"
        safeUpdateData.updatedAt = new Date()

        await db
          .update(companies)
          .set(safeUpdateData)
          .where(eq(companies.id, existing.id))
        updated++
      } else {
        // Insert new company (include all data, even nulls for new records)
        await db.insert(companies).values({
          ...updateData,
          ticker,
          name
        })
        inserted++
      }
    }

    // Calculate overall sync quality
    const processedRows = rows.length - 1 - skipped
    const avgQualityScore = processedRows > 0 ? totalQualityScore / processedRows : 0
    const syncQuality = avgQualityScore >= 0.8 ? "healthy" : avgQualityScore >= 0.5 ? "degraded" : "poor"

    // Log warnings if sync quality is concerning
    if (syncQuality !== "healthy") {
      console.warn(`[SYNC WARNING] Quality: ${syncQuality}, Score: ${(avgQualityScore * 100).toFixed(1)}%, Low quality rows: ${lowQualityRows}`)
      warnings.forEach(w => console.warn(`[SYNC WARNING] ${w}`))
    }

    return NextResponse.json({
      success: true,
      updated,
      inserted,
      skipped,
      total: rows.length - 1,
      timestamp: new Date().toISOString(),
      // Sync health metrics
      syncHealth: {
        quality: syncQuality,
        qualityScore: Math.round(avgQualityScore * 100),
        lowQualityRows,
        warnings: warnings.length > 0 ? warnings : undefined
      }
    })
  } catch (error) {
    console.error("Google Sheets sync cron error:", error)
    return NextResponse.json(
      { error: "Failed to sync from Google Sheets", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    )
  }
}
