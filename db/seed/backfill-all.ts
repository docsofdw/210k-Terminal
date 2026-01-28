/**
 * Master Backfill Script
 *
 * Runs all backfill scripts in the correct order:
 * 1. FX Rates (needed for currency conversion)
 * 2. BTC Prices (needed for mNAV calculations)
 * 3. Stock Prices (depends on FX and BTC data)
 *
 * Usage:
 *   npx bun db/seed/backfill-all.ts
 *   npx bun db/seed/backfill-all.ts --days=365
 *   npx bun db/seed/backfill-all.ts --dry-run
 */

import { execSync } from "child_process"
import process from "process"

// Parse command line arguments
const args = process.argv.slice(2)
const daysArg = args.find(a => a.startsWith("--days="))
const dryRunArg = args.includes("--dry-run")

const days = daysArg ? daysArg.split("=")[1] : "365"
const dryRun = dryRunArg ? "--dry-run" : ""

function runScript(scriptName: string, description: string) {
  console.log(`\n${"=".repeat(60)}`)
  console.log(`🔄 ${description}`)
  console.log(`${"=".repeat(60)}\n`)

  try {
    execSync(`npx bun db/seed/${scriptName} --days=${days} ${dryRun}`, {
      stdio: "inherit",
      cwd: process.cwd()
    })
    console.log(`\n✅ ${description} - Complete`)
  } catch (error) {
    console.error(`\n❌ ${description} - Failed`)
    throw error
  }
}

async function main() {
  console.log("🚀 Master Backfill Script")
  console.log("================================")
  console.log(`Days to backfill: ${days}`)
  console.log(`Dry run: ${dryRunArg}`)
  console.log("")

  const startTime = Date.now()

  try {
    // Step 1: FX Rates
    runScript("backfill-fx-rates.ts", "Step 1/3: Backfilling FX Rates")

    // Step 2: BTC Prices
    runScript("backfill-btc-prices.ts", "Step 2/3: Backfilling BTC Prices")

    // Step 3: Stock Prices
    runScript("backfill-stock-prices.ts", "Step 3/3: Backfilling Stock Prices")

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
    console.log(`\n${"=".repeat(60)}`)
    console.log(`🎉 ALL BACKFILLS COMPLETE`)
    console.log(`${"=".repeat(60)}`)
    console.log(`Total time: ${elapsed} seconds`)
    console.log("")
    console.log("Your charts should now have historical data!")
    console.log("Visit /dashboard/charts to see the results.")
  } catch {
    console.error("\n❌ Backfill failed. Check the error above.")
    process.exit(1)
  }
}

main()
