/**
 * Backfill Historical BTC Prices
 *
 * This script fetches historical BTC price data from CoinGecko
 * and populates the btc_prices table.
 *
 * IMPORTANT: Run this BEFORE running backfill-stock-prices.ts
 *
 * Usage:
 *   npx bun db/seed/backfill-btc-prices.ts
 *   npx bun db/seed/backfill-btc-prices.ts --days=365
 */

import process from "process"
import { db } from "../index"
import { btcPrices } from "../schema/btc-prices"
import { and, gte, lte } from "drizzle-orm"

// Parse command line arguments
const args = process.argv.slice(2)
const daysArg = args.find(a => a.startsWith("--days="))
const dryRunArg = args.includes("--dry-run")

const DAYS_TO_BACKFILL = daysArg ? parseInt(daysArg.split("=")[1]) : 365

interface CoinGeckoMarketChartResponse {
  prices: [number, number][] // [timestamp_ms, price]
  market_caps: [number, number][]
  total_volumes: [number, number][]
}

// Normalize date to midnight UTC
function normalizeDate(date: Date): Date {
  const normalized = new Date(date)
  normalized.setUTCHours(0, 0, 0, 0)
  return normalized
}

// Check if we already have a BTC price for this date
async function hasExistingPrice(date: Date): Promise<boolean> {
  const startOfDay = new Date(date)
  startOfDay.setUTCHours(0, 0, 0, 0)

  const endOfDay = new Date(date)
  endOfDay.setUTCHours(23, 59, 59, 999)

  const existing = await db.query.btcPrices.findFirst({
    where: and(
      gte(btcPrices.priceAt, startOfDay),
      lte(btcPrices.priceAt, endOfDay)
    )
  })

  return !!existing
}

// Fetch historical data from CoinGecko
async function fetchCoinGeckoHistory(days: number): Promise<CoinGeckoMarketChartResponse | null> {
  try {
    // CoinGecko free API has rate limits, so we'll use the market_chart endpoint
    // which gives us daily data for the specified range
    const url = `https://api.coingecko.com/api/v3/coins/bitcoin/market_chart?vs_currency=usd&days=${days}&interval=daily`

    console.log(`📡 Fetching ${days} days of BTC history from CoinGecko...`)

    const response = await fetch(url, {
      headers: {
        Accept: "application/json"
      }
    })

    if (!response.ok) {
      throw new Error(`CoinGecko API error: ${response.status} ${response.statusText}`)
    }

    const data = (await response.json()) as CoinGeckoMarketChartResponse
    return data
  } catch (error) {
    console.error("Error fetching from CoinGecko:", error)
    return null
  }
}

async function main() {
  console.log("🚀 BTC Price Backfill Script")
  console.log("================================")
  console.log(`Days to backfill: ${DAYS_TO_BACKFILL}`)
  console.log(`Dry run: ${dryRunArg}`)
  console.log("")

  // Fetch historical data
  const historyData = await fetchCoinGeckoHistory(DAYS_TO_BACKFILL)

  if (!historyData || historyData.prices.length === 0) {
    console.log("❌ No historical data returned from CoinGecko")
    process.exit(1)
  }

  console.log(`📈 Received ${historyData.prices.length} price points`)

  let insertedCount = 0
  let skippedCount = 0
  let errorCount = 0

  // Process each day
  for (let i = 0; i < historyData.prices.length; i++) {
    const [timestamp, price] = historyData.prices[i]
    const priceDate = normalizeDate(new Date(timestamp))

    // Get corresponding market cap and volume if available
    const marketCap = historyData.market_caps[i]?.[1] ?? null
    const volume = historyData.total_volumes[i]?.[1] ?? null

    try {
      // Check if we already have data for this date
      const hasExisting = await hasExistingPrice(priceDate)
      if (hasExisting) {
        skippedCount++
        continue
      }

      if (!dryRunArg) {
        await db.insert(btcPrices).values({
          priceUsd: price.toString(),
          marketCap: marketCap?.toString() ?? null,
          volume24h: volume?.toString() ?? null,
          priceAt: priceDate
        })
      }

      insertedCount++

      // Log progress every 50 days
      if (insertedCount % 50 === 0) {
        console.log(`  📊 Inserted ${insertedCount} price points...`)
      }
    } catch (error) {
      errorCount++
      console.error(`  ❌ Error inserting price for ${priceDate.toISOString()}:`, error)
    }
  }

  console.log("\n================================")
  console.log("📊 BACKFILL SUMMARY")
  console.log("================================")
  console.log(`Total price points received: ${historyData.prices.length}`)
  console.log(`Prices inserted: ${insertedCount}`)
  console.log(`Prices skipped (already exist): ${skippedCount}`)
  console.log(`Errors: ${errorCount}`)

  if (dryRunArg) {
    console.log("\n⚠️  DRY RUN - No data was actually inserted")
  }

  console.log("\n✅ BTC price backfill complete!")
  console.log("\n💡 Next step: Run the stock price backfill:")
  console.log("   npx bun db/seed/backfill-stock-prices.ts")

  db.$client.end()
}

main().catch(error => {
  console.error("Fatal error:", error)
  process.exit(1)
})
