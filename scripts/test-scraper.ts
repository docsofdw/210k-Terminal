/**
 * Quick test script for scrapers
 * Run: npx tsx scripts/test-scraper.ts [--browser]
 *
 * Use --browser flag to also test browser-based scrapers (slower)
 */

import { scrapeSWC, formatSharesData } from "../lib/scrapers"
import { parseMoonIncPdf } from "../lib/scrapers/moon-inc-scraper"
import {
  scrapeLQWD,
  scrapeCapitalB,
  scrapeOranje,
  scrapeMetaplanet,
  closeBrowser
} from "../lib/scrapers/browser-scraper"
import { scrapeStrategy } from "../lib/scrapers/strategy-scraper"
import * as fs from "fs"
import * as path from "path"

const testBrowser = process.argv.includes("--browser")

async function testSWC() {
  console.log("Testing SWC scraper...")
  console.log("=".repeat(50))

  const result = await scrapeSWC()

  if (result.success && result.data) {
    console.log("✓ SWC scraper successful")
    console.log("  Source:", result.source)
    console.log("  Data:", formatSharesData(result.data))
    console.log("  Notes:", result.data.notes || "N/A")
  } else {
    console.log("✗ SWC scraper failed")
    console.log("  Error:", result.error)
  }
  console.log()
}

async function testMoonInc() {
  console.log("Testing Moon Inc PDF parser...")
  console.log("=".repeat(50))

  const pdfPath = path.join(
    __dirname,
    "../docs/build_process/pdf-examples/Moon-inc-monthly-return.pdf"
  )

  if (!fs.existsSync(pdfPath)) {
    console.log("✗ Moon Inc PDF not found at:", pdfPath)
    return
  }

  const pdfBuffer = fs.readFileSync(pdfPath)
  const result = await parseMoonIncPdf(pdfBuffer, pdfPath)

  if (result.success && result.data) {
    console.log("✓ Moon Inc PDF parser successful")
    console.log("  Report month:", result.data.reportMonth || "N/A")
    console.log(
      "  Shares outstanding:",
      result.data.sharesOutstanding.toLocaleString()
    )
    console.log("  Diluted shares:", result.data.dilutedShares.toLocaleString())
    console.log("  Convertibles:", result.data.convertibles?.toLocaleString() || "0")
  } else {
    console.log("✗ Moon Inc PDF parser failed")
    console.log("  Error:", result.error)
  }
  console.log()
}

async function testBrowserScrapers() {
  console.log("Testing Browser-based scrapers...")
  console.log("=".repeat(50))
  console.log("(This may take a while - launching headless Chrome)\n")

  const scrapers = [
    { name: "LQWD Technologies", scraper: scrapeLQWD },
    { name: "Capital B", scraper: scrapeCapitalB },
    { name: "Oranje BTC", scraper: scrapeOranje },
    { name: "Metaplanet", scraper: scrapeMetaplanet },
    { name: "Strategy (MSTR)", scraper: scrapeStrategy }
  ]

  for (const { name, scraper } of scrapers) {
    console.log(`Testing ${name}...`)
    try {
      const result = await scraper()
      if (result.success && result.data) {
        console.log(`✓ ${name} successful`)
        console.log("  Data:", formatSharesData(result.data))
      } else {
        console.log(`✗ ${name} failed`)
        console.log("  Error:", result.error)
      }
    } catch (error) {
      console.log(`✗ ${name} crashed`)
      console.log("  Error:", error instanceof Error ? error.message : error)
    }
    console.log()
  }

  await closeBrowser()
}

async function main() {
  console.log("\nPortfolio Scraper Tests\n")

  // Always run HTML and PDF scrapers
  await testSWC()
  await testMoonInc()

  // Only run browser scrapers with flag
  if (testBrowser) {
    await testBrowserScrapers()
  } else {
    console.log("Skipping browser-based scrapers (use --browser flag to test)")
    console.log()
  }

  console.log("Done!")
}

main().catch(console.error)
