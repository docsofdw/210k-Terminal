/**
 * Backfill Historical FX Rates
 *
 * This script creates historical FX rate entries using current rates as approximation.
 * For more accurate historical rates, you would need a paid FX data provider.
 *
 * IMPORTANT: Run this BEFORE running backfill-stock-prices.ts
 *
 * Usage:
 *   npx bun db/seed/backfill-fx-rates.ts
 *   npx bun db/seed/backfill-fx-rates.ts --days=365
 */

import process from "process"
import { db } from "../index"
import { fxRates } from "../schema/fx-rates"
import { and, gte, lte, eq } from "drizzle-orm"

// Parse command line arguments
const args = process.argv.slice(2)
const daysArg = args.find(a => a.startsWith("--days="))
const dryRunArg = args.includes("--dry-run")

const DAYS_TO_BACKFILL = daysArg ? parseInt(daysArg.split("=")[1]) : 365

// Current approximate FX rates (USD to currency)
// These are approximations - for production, use a historical FX API
const CURRENT_FX_RATES: Record<string, number> = {
  CAD: 1.36,  // 1 USD = 1.36 CAD
  EUR: 0.92,  // 1 USD = 0.92 EUR
  GBP: 0.79,  // 1 USD = 0.79 GBP (also note: LSE prices in pence, divide by 100)
  JPY: 149.5, // 1 USD = 149.5 JPY
  HKD: 7.82,  // 1 USD = 7.82 HKD
  AUD: 1.53,  // 1 USD = 1.53 AUD
  BRL: 4.97,  // 1 USD = 4.97 BRL
  THB: 34.5,  // 1 USD = 34.5 THB
  KRW: 1320,  // 1 USD = 1320 KRW
}

// Normalize date to midnight UTC
function normalizeDate(date: Date): Date {
  const normalized = new Date(date)
  normalized.setUTCHours(0, 0, 0, 0)
  return normalized
}

// Check if we already have an FX rate for this currency on this date
async function hasExistingRate(currency: string, date: Date): Promise<boolean> {
  const startOfDay = new Date(date)
  startOfDay.setUTCHours(0, 0, 0, 0)

  const endOfDay = new Date(date)
  endOfDay.setUTCHours(23, 59, 59, 999)

  const existing = await db.query.fxRates.findFirst({
    where: and(
      eq(fxRates.currency, currency),
      gte(fxRates.rateAt, startOfDay),
      lte(fxRates.rateAt, endOfDay)
    )
  })

  return !!existing
}

async function main() {
  console.log("🚀 FX Rates Backfill Script")
  console.log("================================")
  console.log(`Days to backfill: ${DAYS_TO_BACKFILL}`)
  console.log(`Dry run: ${dryRunArg}`)
  console.log(`Currencies: ${Object.keys(CURRENT_FX_RATES).join(", ")}`)
  console.log("")

  console.log("⚠️  Note: Using current FX rates as approximation for historical data.")
  console.log("   For accurate historical rates, consider using a paid FX data API.")
  console.log("")

  let insertedCount = 0
  let skippedCount = 0
  let errorCount = 0

  // Generate dates to backfill
  const dates: Date[] = []
  for (let i = 0; i <= DAYS_TO_BACKFILL; i++) {
    const date = new Date()
    date.setDate(date.getDate() - i)
    dates.push(normalizeDate(date))
  }

  console.log(`📅 Backfilling ${dates.length} days for ${Object.keys(CURRENT_FX_RATES).length} currencies...`)

  // Process each currency
  for (const [currency, rateToUsd] of Object.entries(CURRENT_FX_RATES)) {
    console.log(`\n💱 Processing ${currency}...`)

    let currencyInserted = 0

    for (const date of dates) {
      try {
        // Check if we already have data for this date
        const hasExisting = await hasExistingRate(currency, date)
        if (hasExisting) {
          skippedCount++
          continue
        }

        // Add slight random variation (+/- 2%) to simulate historical variance
        // This is just for demo purposes - use real historical data in production
        const variance = 1 + (Math.random() * 0.04 - 0.02)
        const historicalRate = rateToUsd * variance
        const inverseRate = 1 / historicalRate

        if (!dryRunArg) {
          await db.insert(fxRates).values({
            currency,
            rateToUsd: historicalRate.toFixed(6),
            rateFromUsd: inverseRate.toFixed(6),
            rateAt: date
          })
        }

        insertedCount++
        currencyInserted++
      } catch (error) {
        errorCount++
        console.error(`  ❌ Error inserting rate for ${currency} on ${date.toISOString()}:`, error)
      }
    }

    console.log(`  ✅ Inserted ${currencyInserted} rates for ${currency}`)
  }

  console.log("\n================================")
  console.log("📊 BACKFILL SUMMARY")
  console.log("================================")
  console.log(`Currencies processed: ${Object.keys(CURRENT_FX_RATES).length}`)
  console.log(`Rates inserted: ${insertedCount}`)
  console.log(`Rates skipped (already exist): ${skippedCount}`)
  console.log(`Errors: ${errorCount}`)

  if (dryRunArg) {
    console.log("\n⚠️  DRY RUN - No data was actually inserted")
  }

  console.log("\n✅ FX rates backfill complete!")
  console.log("\n💡 Next steps:")
  console.log("   1. npx bun db/seed/backfill-btc-prices.ts")
  console.log("   2. npx bun db/seed/backfill-stock-prices.ts")

  db.$client.end()
}

main().catch(error => {
  console.error("Fatal error:", error)
  process.exit(1)
})
