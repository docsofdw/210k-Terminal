import { config } from "dotenv"
import { drizzle } from "drizzle-orm/postgres-js"
import postgres from "postgres"
import { companies } from "../schema/companies"
import { btcPrices } from "../schema/btc-prices"
import { eq } from "drizzle-orm"
import { google } from "googleapis"

config({ path: ".env.local" })

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) {
  throw new Error("DATABASE_URL is not set")
}

const client = postgres(databaseUrl, { prepare: false })
const db = drizzle(client)

// Sheet configuration
const SPREADSHEET_ID = "1fNQGJIaDT3czM7Bqd9dZ6WTJYk-54niL9F3Pe9zYgpQ"
const COMPS_TABLE_SHEET = "Comps Table"

// Map sheet company names to database tickers
// Based on actual column headers in the Google Sheet
const COMPANY_NAME_TO_TICKER: Record<string, string> = {
  // Exact matches from sheet column headers (Row 3)
  "Strategy": "MSTR",           // Column C - MicroStrategy (not in DB)
  "Metaplanet": "3350.T",       // Column D
  "LQWD": "LQWD.V",             // Column E
  "Matador": "MATA.V",          // Column F
  "Moon Inc": "1723.HK",        // Column G
  "Smarter Web Company": "SWC.AQ", // Column H
  "Capital B": "ALCPB.PA",      // Column I
  "H100": "H100",               // Column J - not in DB
  "DV8": "DV8.BK",              // Column K
  "BTCT": "BTCT.V",             // Column L
  "satsuma": "SATS.L",          // Column M
  "DigitalX": "DCC.AX",         // Column N
  "aifinyo": "EBEN.HM",         // Column O
  "bitplanet": "049470.KQ",     // Column P
  "oranje": "OBTC3",            // Column Q
  "ABTC": "ABTC",               // Column R

  // Alternate capitalizations
  "Satsuma": "SATS.L",
  "Aifinyo": "EBEN.HM",
  "Bitplanet": "049470.KQ",
  "Oranje": "OBTC3",
}

// Row indices in the sheet (0-indexed from A1)
const ROW_INDICES = {
  COMPANY_NAMES: 2,      // Row 3 - company names
  BTC_HOLDINGS: 3,       // Row 4 - BTC in treasury
  BTC_NAV_USD: 4,        // Row 5 - BTC NAV USD
  SHARE_COUNT: 5,        // Row 6 - Share count
  LOCAL_PRICE: 6,        // Row 7 - Local price
  MKT_CAP_LOCAL: 7,      // Row 8 - Mkt Cap (local)
  MKT_CAP_USD: 8,        // Row 9 - Mkt Cap USD
  DEBT_USD: 9,           // Row 10 - Debt (USD)
  PREFERREDS: 10,        // Row 11 - Preferreds
  CASH_USD: 11,          // Row 12 - Cash (USD)
  EV_USD: 13,            // Row 14 - EV USD
  MNAV: 14,              // Row 15 - mNAV
}

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

function parseNumber(val: string | undefined | null): number | null {
  if (!val) return null
  // Remove currency symbols, commas, spaces, and percentage signs
  const cleaned = val.toString()
    .replace(/[$€£¥₩฿,\s%]/g, "")
    .replace(/[()]/g, "-") // Handle negative numbers in parentheses
    .trim()

  if (cleaned === "" || cleaned === "-") return null

  const num = parseFloat(cleaned)
  return isNaN(num) ? null : num
}

function findTicker(companyName: string): string | null {
  // Direct match
  if (COMPANY_NAME_TO_TICKER[companyName]) {
    return COMPANY_NAME_TO_TICKER[companyName]
  }

  // Case-insensitive match
  const lowerName = companyName.toLowerCase().trim()
  for (const [name, ticker] of Object.entries(COMPANY_NAME_TO_TICKER)) {
    if (name.toLowerCase() === lowerName) {
      return ticker
    }
  }

  // Partial match
  for (const [name, ticker] of Object.entries(COMPANY_NAME_TO_TICKER)) {
    if (lowerName.includes(name.toLowerCase()) || name.toLowerCase().includes(lowerName)) {
      return ticker
    }
  }

  return null
}

interface CompanyData {
  name: string
  ticker: string | null
  btcHoldings: number | null
  sharesOutstanding: number | null
  debtUsd: number | null
  preferredsUsd: number | null
  cashUsd: number | null
}

async function syncFromSheets() {
  console.log("🔄 Syncing company data from Google Sheets...")
  console.log(`📊 Spreadsheet ID: ${SPREADSHEET_ID}`)
  console.log(`📋 Sheet: ${COMPS_TABLE_SHEET}\n`)

  const auth = getGoogleAuth()
  const sheets = google.sheets({ version: "v4", auth })

  // Fetch a wide range to capture all companies (A through AZ for ~52 columns)
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `'${COMPS_TABLE_SHEET}'!A1:AZ20`
  })

  const rows = response.data.values
  if (!rows || rows.length < 15) {
    throw new Error("Insufficient data in sheet")
  }

  // Debug: print what we got
  console.log("📝 Sheet data preview:")
  console.log(`   Row 3 (names): ${rows[ROW_INDICES.COMPANY_NAMES]?.slice(0, 10).join(" | ")}`)
  console.log(`   Row 4 (BTC):   ${rows[ROW_INDICES.BTC_HOLDINGS]?.slice(0, 10).join(" | ")}`)
  console.log("")

  // Extract BTC price from B3 cell
  const btcPriceCell = rows[2]?.[1] // Row 3, Column B
  const btcPrice = parseNumber(btcPriceCell)
  console.log(`💰 BTC Price: $${btcPrice?.toLocaleString() ?? "N/A"}`)

  // Get company names from row 3 (index 2), starting from column C (index 2)
  const companyRow = rows[ROW_INDICES.COMPANY_NAMES]
  const btcRow = rows[ROW_INDICES.BTC_HOLDINGS]
  const shareRow = rows[ROW_INDICES.SHARE_COUNT]
  const debtRow = rows[ROW_INDICES.DEBT_USD]
  const preferredsRow = rows[ROW_INDICES.PREFERREDS]
  const cashRow = rows[ROW_INDICES.CASH_USD]

  const companiesData: CompanyData[] = []

  // Start from column C (index 2) to skip label columns
  for (let col = 2; col < companyRow.length; col++) {
    const name = companyRow[col]?.toString().trim()
    if (!name) continue

    const ticker = findTicker(name)

    companiesData.push({
      name,
      ticker,
      btcHoldings: parseNumber(btcRow?.[col]),
      sharesOutstanding: parseNumber(shareRow?.[col]),
      debtUsd: parseNumber(debtRow?.[col]),
      preferredsUsd: parseNumber(preferredsRow?.[col]),
      cashUsd: parseNumber(cashRow?.[col]),
    })
  }

  console.log(`\n📊 Found ${companiesData.length} companies in sheet:\n`)

  // Update database
  let updated = 0
  let skipped = 0
  let notFound = 0

  for (const data of companiesData) {
    if (!data.ticker) {
      console.log(`⚠️  No ticker mapping for: "${data.name}"`)
      notFound++
      continue
    }

    // Find company in database
    const [existing] = await db
      .select()
      .from(companies)
      .where(eq(companies.ticker, data.ticker))
      .limit(1)

    if (!existing) {
      console.log(`⚠️  Ticker not in database: ${data.ticker} (${data.name})`)
      skipped++
      continue
    }

    // Update company with financial data
    await db
      .update(companies)
      .set({
        btcHoldings: data.btcHoldings?.toString() ?? null,
        sharesOutstanding: data.sharesOutstanding?.toString() ?? null,
        debtUsd: data.debtUsd?.toString() ?? null,
        preferredsUsd: data.preferredsUsd?.toString() ?? null,
        cashUsd: data.cashUsd?.toString() ?? null,
        btcHoldingsDate: new Date(),
        btcHoldingsSource: "Google Sheets sync",
        updatedAt: new Date(),
      })
      .where(eq(companies.id, existing.id))

    console.log(`✅ Updated: ${existing.ticker.padEnd(10)} | BTC: ${data.btcHoldings?.toLocaleString().padStart(12) ?? "N/A".padStart(12)} | Shares: ${data.sharesOutstanding?.toLocaleString().padStart(15) ?? "N/A".padStart(15)}`)
    updated++
  }

  // Update BTC price if we got one
  if (btcPrice) {
    await db.insert(btcPrices).values({
      priceUsd: btcPrice.toString(),
      priceAt: new Date(),
    })
    console.log(`\n💰 Inserted BTC price: $${btcPrice.toLocaleString()}`)
  }

  console.log(`\n📊 Sync Summary:`)
  console.log(`   ✅ Updated: ${updated}`)
  console.log(`   ⚠️  Skipped (not in DB): ${skipped}`)
  console.log(`   ❓ No ticker mapping: ${notFound}`)
  console.log(`\n✨ Sync complete!`)

  await client.end()
  process.exit(0)
}

syncFromSheets().catch(error => {
  console.error("❌ Sync failed:", error)
  process.exit(1)
})
