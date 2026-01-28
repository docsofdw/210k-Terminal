/**
 * Backfill Historical Stock Prices
 *
 * This script fetches historical stock price data from Yahoo Finance
 * and populates both the stock_prices table and daily_snapshots table.
 *
 * Usage:
 *   npx bun db/seed/backfill-stock-prices.ts
 *   npx bun db/seed/backfill-stock-prices.ts --days=365
 *   npx bun db/seed/backfill-stock-prices.ts --ticker=MSTR
 */

import process from "process"
import { db } from "../index"
import { companies } from "../schema/companies"
import { stockPrices } from "../schema/stock-prices"
import { dailySnapshots, marketSnapshots } from "../schema/daily-snapshots"
import { btcPrices } from "../schema/btc-prices"
import { fxRates } from "../schema/fx-rates"
import { getHistoricalPrices } from "@/lib/api/yahoo-finance"
import { eq, and, gte, lte, desc, asc } from "drizzle-orm"

// Parse command line arguments
const args = process.argv.slice(2)
const daysArg = args.find(a => a.startsWith("--days="))
const tickerArg = args.find(a => a.startsWith("--ticker="))
const dryRunArg = args.includes("--dry-run")

const DAYS_TO_BACKFILL = daysArg ? parseInt(daysArg.split("=")[1]) : 365
const SPECIFIC_TICKER = tickerArg ? tickerArg.split("=")[1].toUpperCase() : null

// LSE stocks are quoted in pence (0.01 GBP), need to convert to GBP
function adjustForPence(price: number, yahooTicker: string): number {
  if (yahooTicker.endsWith(".L")) {
    return price / 100
  }
  return price
}

interface BackfillResult {
  ticker: string
  yahooTicker: string
  daysBackfilled: number
  stockPricesInserted: number
  dailySnapshotsInserted: number
  errors: string[]
}

// Normalize date to midnight UTC
function normalizeDate(date: Date): Date {
  const normalized = new Date(date)
  normalized.setUTCHours(0, 0, 0, 0)
  return normalized
}

// Get historical BTC price for a specific date (or closest available)
async function getBtcPriceForDate(date: Date): Promise<number | null> {
  const startOfDay = new Date(date)
  startOfDay.setUTCHours(0, 0, 0, 0)

  const endOfDay = new Date(date)
  endOfDay.setUTCHours(23, 59, 59, 999)

  // Try to find price for this exact date
  const priceRecord = await db.query.btcPrices.findFirst({
    where: and(
      gte(btcPrices.priceAt, startOfDay),
      lte(btcPrices.priceAt, endOfDay)
    ),
    orderBy: [desc(btcPrices.priceAt)]
  })

  if (priceRecord) {
    return parseFloat(priceRecord.priceUsd)
  }

  // Fall back to closest price before this date
  const closestPrice = await db.query.btcPrices.findFirst({
    where: lte(btcPrices.priceAt, endOfDay),
    orderBy: [desc(btcPrices.priceAt)]
  })

  return closestPrice ? parseFloat(closestPrice.priceUsd) : null
}

// Get FX rate for a currency on a specific date
async function getFxRateForDate(
  currency: string,
  date: Date
): Promise<number> {
  if (currency === "USD") return 1

  const endOfDay = new Date(date)
  endOfDay.setUTCHours(23, 59, 59, 999)

  const rateRecord = await db.query.fxRates.findFirst({
    where: and(
      eq(fxRates.currency, currency),
      lte(fxRates.rateAt, endOfDay)
    ),
    orderBy: [desc(fxRates.rateAt)]
  })

  // If no FX rate found, return 1 (assume USD)
  return rateRecord ? parseFloat(rateRecord.rateToUsd) : 1
}

// Check if we already have a daily snapshot for this company on this date
async function hasExistingSnapshot(
  companyId: string,
  date: Date
): Promise<boolean> {
  const startOfDay = new Date(date)
  startOfDay.setUTCHours(0, 0, 0, 0)

  const endOfDay = new Date(date)
  endOfDay.setUTCHours(23, 59, 59, 999)

  const existing = await db.query.dailySnapshots.findFirst({
    where: and(
      eq(dailySnapshots.companyId, companyId),
      gte(dailySnapshots.snapshotDate, startOfDay),
      lte(dailySnapshots.snapshotDate, endOfDay)
    )
  })

  return !!existing
}

// Backfill data for a single company
async function backfillCompany(
  company: typeof companies.$inferSelect
): Promise<BackfillResult> {
  const result: BackfillResult = {
    ticker: company.ticker,
    yahooTicker: company.yahooTicker,
    daysBackfilled: 0,
    stockPricesInserted: 0,
    dailySnapshotsInserted: 0,
    errors: []
  }

  console.log(`\n📊 Backfilling ${company.name} (${company.yahooTicker})...`)

  // Calculate date range
  const endDate = new Date()
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - DAYS_TO_BACKFILL)

  try {
    // Fetch historical prices from Yahoo Finance
    const historicalPrices = await getHistoricalPrices(
      company.yahooTicker,
      startDate,
      endDate
    )

    if (historicalPrices.length === 0) {
      result.errors.push("No historical data returned from Yahoo Finance")
      console.log(`  ⚠️  No historical data found`)
      return result
    }

    console.log(`  📈 Found ${historicalPrices.length} days of historical data`)

    // Process each day
    for (const day of historicalPrices) {
      const snapshotDate = normalizeDate(day.date)

      // Skip if we already have a snapshot for this date
      const hasSnapshot = await hasExistingSnapshot(company.id, snapshotDate)
      if (hasSnapshot) {
        continue
      }

      // Get BTC price for this date
      const btcPrice = await getBtcPriceForDate(snapshotDate)
      if (!btcPrice) {
        // Skip days where we don't have BTC price data
        continue
      }

      // Get FX rate for this date
      const fxRate = await getFxRateForDate(company.tradingCurrency, snapshotDate)

      // Use close price as the stock price (adjust for LSE pence if needed)
      const stockPrice = adjustForPence(day.close, company.yahooTicker)

      // Calculate USD price (fxRate is how many local currency = 1 USD)
      // So to get USD: localPrice / fxRate
      const stockPriceUsd = stockPrice / fxRate

      // Parse company financial data
      const btcHoldings = company.btcHoldings
        ? parseFloat(company.btcHoldings)
        : null
      const sharesOutstanding = company.sharesOutstanding
        ? parseFloat(company.sharesOutstanding)
        : null
      const cashUsd = company.cashUsd ? parseFloat(company.cashUsd) : 0
      const debtUsd = company.debtUsd ? parseFloat(company.debtUsd) : 0
      const preferredsUsd = company.preferredsUsd
        ? parseFloat(company.preferredsUsd)
        : 0

      // Calculate metrics
      const marketCapUsd =
        stockPriceUsd && sharesOutstanding
          ? stockPriceUsd * sharesOutstanding
          : null

      const btcNav = btcHoldings ? btcHoldings * btcPrice : null

      const evUsd = marketCapUsd
        ? marketCapUsd + debtUsd + preferredsUsd - cashUsd
        : null

      let mNav: number | null = null
      if (evUsd && btcNav && btcNav > 0) {
        mNav = evUsd / btcNav
      }

      const satsPerShare =
        btcHoldings && sharesOutstanding
          ? (btcHoldings * 100_000_000) / sharesOutstanding
          : null

      const btcPerShare =
        btcHoldings && sharesOutstanding ? btcHoldings / sharesOutstanding : null

      if (!dryRunArg) {
        // Adjust all OHLC prices for LSE pence if needed
        const adjustedOpen = adjustForPence(day.open, company.yahooTicker)
        const adjustedHigh = adjustForPence(day.high, company.yahooTicker)
        const adjustedLow = adjustForPence(day.low, company.yahooTicker)
        const adjustedClose = adjustForPence(day.close, company.yahooTicker)

        // Insert stock price record (in local currency)
        await db.insert(stockPrices).values({
          companyId: company.id,
          price: stockPrice.toString(),
          open: adjustedOpen.toString(),
          high: adjustedHigh.toString(),
          low: adjustedLow.toString(),
          close: adjustedClose.toString(),
          volume: day.volume.toString(),
          priceAt: snapshotDate
        })
        result.stockPricesInserted++

        // Insert daily snapshot
        await db.insert(dailySnapshots).values({
          snapshotDate,
          companyId: company.id,
          ticker: company.ticker,
          companyName: company.name,
          stockPrice: stockPrice.toString(),
          stockPriceUsd: stockPriceUsd.toString(),
          marketCapUsd: marketCapUsd?.toString() ?? null,
          btcPrice: btcPrice.toString(),
          btcHoldings: btcHoldings?.toString() ?? null,
          btcNav: btcNav?.toString() ?? null,
          evUsd: evUsd?.toString() ?? null,
          mNav: mNav?.toString() ?? null,
          satsPerShare: satsPerShare?.toString() ?? null,
          btcPerShare: btcPerShare?.toString() ?? null,
          sharesOutstanding: sharesOutstanding?.toString() ?? null,
          cashUsd: cashUsd.toString(),
          debtUsd: debtUsd.toString(),
          preferredsUsd: preferredsUsd.toString(),
          fxRate: fxRate.toString(),
          tradingCurrency: company.tradingCurrency,
          dataSource: "yahoo_finance_backfill",
          rawData: { historicalDay: day, btcPrice, fxRate }
        })
        result.dailySnapshotsInserted++
      }

      result.daysBackfilled++
    }

    console.log(
      `  ✅ Backfilled ${result.daysBackfilled} days (${result.stockPricesInserted} stock prices, ${result.dailySnapshotsInserted} snapshots)`
    )
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    result.errors.push(errorMessage)
    console.error(`  ❌ Error: ${errorMessage}`)
  }

  // Rate limiting - wait between companies
  await new Promise(resolve => setTimeout(resolve, 1000))

  return result
}

// Generate market snapshots for dates that have daily snapshots
async function generateMarketSnapshots(): Promise<number> {
  console.log("\n📊 Generating market snapshots from daily snapshots...")

  // Get all unique dates from daily snapshots
  const allSnapshots = await db
    .select({
      snapshotDate: dailySnapshots.snapshotDate,
      btcPrice: dailySnapshots.btcPrice,
      btcHoldings: dailySnapshots.btcHoldings,
      marketCapUsd: dailySnapshots.marketCapUsd,
      evUsd: dailySnapshots.evUsd,
      btcNav: dailySnapshots.btcNav,
      mNav: dailySnapshots.mNav
    })
    .from(dailySnapshots)
    .orderBy(asc(dailySnapshots.snapshotDate))

  // Group by date
  const byDate = new Map<
    string,
    {
      btcPrice: number
      btcHoldings: number[]
      marketCaps: number[]
      evs: number[]
      btcNavs: number[]
      mNavs: number[]
    }
  >()

  for (const snapshot of allSnapshots) {
    const dateKey = snapshot.snapshotDate.toISOString().split("T")[0]

    if (!byDate.has(dateKey)) {
      byDate.set(dateKey, {
        btcPrice: parseFloat(snapshot.btcPrice),
        btcHoldings: [],
        marketCaps: [],
        evs: [],
        btcNavs: [],
        mNavs: []
      })
    }

    const dayData = byDate.get(dateKey)!

    if (snapshot.btcHoldings)
      dayData.btcHoldings.push(parseFloat(snapshot.btcHoldings))
    if (snapshot.marketCapUsd)
      dayData.marketCaps.push(parseFloat(snapshot.marketCapUsd))
    if (snapshot.evUsd) dayData.evs.push(parseFloat(snapshot.evUsd))
    if (snapshot.btcNav) dayData.btcNavs.push(parseFloat(snapshot.btcNav))
    if (snapshot.mNav) dayData.mNavs.push(parseFloat(snapshot.mNav))
  }

  let insertedCount = 0

  for (const [dateKey, data] of byDate) {
    const snapshotDate = new Date(dateKey)
    snapshotDate.setUTCHours(0, 0, 0, 0)

    // Check if market snapshot already exists
    const existing = await db.query.marketSnapshots.findFirst({
      where: and(
        gte(marketSnapshots.snapshotDate, snapshotDate),
        lte(
          marketSnapshots.snapshotDate,
          new Date(snapshotDate.getTime() + 24 * 60 * 60 * 1000)
        )
      )
    })

    if (existing) continue

    // Calculate aggregates
    const totalBtcHoldings = data.btcHoldings.reduce((a, b) => a + b, 0)
    const totalMarketCapUsd = data.marketCaps.reduce((a, b) => a + b, 0)
    const totalEvUsd = data.evs.reduce((a, b) => a + b, 0)
    const totalBtcNav = data.btcNavs.reduce((a, b) => a + b, 0)

    const avgMNav =
      data.mNavs.length > 0
        ? data.mNavs.reduce((a, b) => a + b, 0) / data.mNavs.length
        : null

    const sortedMNavs = [...data.mNavs].sort((a, b) => a - b)
    const medianMNav =
      sortedMNavs.length > 0
        ? sortedMNavs.length % 2 === 0
          ? (sortedMNavs[sortedMNavs.length / 2 - 1] +
              sortedMNavs[sortedMNavs.length / 2]) /
            2
          : sortedMNavs[Math.floor(sortedMNavs.length / 2)]
        : null

    // Weighted average mNAV
    let weightedAvgMNav: number | null = null
    if (totalMarketCapUsd > 0 && data.mNavs.length > 0) {
      // Simplified - use equal weighting since we don't have per-snapshot market caps here
      weightedAvgMNav = avgMNav
    }

    if (!dryRunArg) {
      await db.insert(marketSnapshots).values({
        snapshotDate,
        btcPrice: data.btcPrice.toString(),
        totalBtcHoldings: totalBtcHoldings.toString(),
        totalMarketCapUsd: totalMarketCapUsd.toString(),
        totalEvUsd: totalEvUsd.toString(),
        totalBtcNav: totalBtcNav.toString(),
        avgMNav: avgMNav?.toString() ?? null,
        medianMNav: medianMNav?.toString() ?? null,
        weightedAvgMNav: weightedAvgMNav?.toString() ?? null,
        companyCount: data.mNavs.length.toString()
      })
      insertedCount++
    }
  }

  return insertedCount
}

async function main() {
  console.log("🚀 Stock Price Backfill Script")
  console.log("================================")
  console.log(`Days to backfill: ${DAYS_TO_BACKFILL}`)
  console.log(`Specific ticker: ${SPECIFIC_TICKER || "All companies"}`)
  console.log(`Dry run: ${dryRunArg}`)
  console.log("")

  // Get companies to backfill
  let companiesToBackfill
  if (SPECIFIC_TICKER) {
    companiesToBackfill = await db
      .select()
      .from(companies)
      .where(eq(companies.ticker, SPECIFIC_TICKER))
  } else {
    companiesToBackfill = await db
      .select()
      .from(companies)
      .where(eq(companies.isTracked, true))
  }

  if (companiesToBackfill.length === 0) {
    console.log("❌ No companies found to backfill")
    process.exit(1)
  }

  console.log(`📋 Found ${companiesToBackfill.length} companies to backfill`)

  const results: BackfillResult[] = []

  for (const company of companiesToBackfill) {
    const result = await backfillCompany(company)
    results.push(result)
  }

  // Generate market snapshots
  const marketSnapshotsInserted = await generateMarketSnapshots()

  // Print summary
  console.log("\n================================")
  console.log("📊 BACKFILL SUMMARY")
  console.log("================================")

  let totalDays = 0
  let totalStockPrices = 0
  let totalSnapshots = 0
  let companiesWithErrors = 0

  for (const result of results) {
    totalDays += result.daysBackfilled
    totalStockPrices += result.stockPricesInserted
    totalSnapshots += result.dailySnapshotsInserted
    if (result.errors.length > 0) companiesWithErrors++

    console.log(
      `  ${result.ticker}: ${result.daysBackfilled} days${result.errors.length > 0 ? ` (${result.errors.length} errors)` : ""}`
    )
  }

  console.log("")
  console.log(`Total days backfilled: ${totalDays}`)
  console.log(`Stock prices inserted: ${totalStockPrices}`)
  console.log(`Daily snapshots inserted: ${totalSnapshots}`)
  console.log(`Market snapshots inserted: ${marketSnapshotsInserted}`)
  console.log(`Companies with errors: ${companiesWithErrors}`)

  if (dryRunArg) {
    console.log("\n⚠️  DRY RUN - No data was actually inserted")
  }

  console.log("\n✅ Backfill complete!")
  db.$client.end()
}

main().catch(error => {
  console.error("Fatal error:", error)
  process.exit(1)
})
