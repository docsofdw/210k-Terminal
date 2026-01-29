import { config } from "dotenv"
import { drizzle } from "drizzle-orm/postgres-js"
import postgres from "postgres"
import { companies } from "../schema/companies"
import { eq } from "drizzle-orm"
import { google } from "googleapis"

config({ path: ".env.local" })

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) {
  throw new Error("DATABASE_URL is not set")
}

const client = postgres(databaseUrl, { prepare: false })
const db = drizzle(client)

// New BTCTCs Master Sheet configuration
const SPREADSHEET_ID = "1_whntepzncCFsn-K1oyL5Epqh5D6mauAOnb_Zs7svkk"
const DASHBOARD_SHEET = "Dashboard"

// Critical fields that should have data for a valid sync
const CRITICAL_FIELDS = ["price", "marketCapUsd", "dilutedMNav", "enterpriseValueUsd", "btcNavUsd"] as const

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

interface SheetRow {
  rank: string | null
  name: string
  ticker: string
  btcHoldings: string | null
  basicMNav: string | null
  dilutedMNav: string | null
  price: string | null
  priceChange1d: string | null
  priceAt1xDilutedMNav: string | null
  enterpriseValueUsd: string | null
  avgVolumeUsd: string | null
  btcNavUsd: string | null
  debtUsd: string | null
  high1y: string | null
  high1yDelta: string | null
  avg200d: string | null
  avg200dDelta: string | null
  insiderBuySellRatio: string | null
  cashUsd: string | null
  marketCapUsd: string | null
  sharesOutstanding: string | null
  dilutedShares: string | null
  dilutedMarketCapUsd: string | null
  dilutedEvUsd: string | null
  exchange: string | null
  avgVolumeShares: string | null
  priceChange5d: string | null
  priceChange1m: string | null
  priceChangeYtd: string | null
  priceChange1y: string | null
  currencyCode: string | null
  conversionRate: string | null
  region: string | null
  subRegion: string | null
  category: string | null
}

async function syncFromSheets() {
  console.log("🔄 Syncing company data from BTCTCs Master Sheet...")
  console.log(`📊 Spreadsheet ID: ${SPREADSHEET_ID}`)
  console.log(`📋 Sheet: ${DASHBOARD_SHEET}\n`)

  const auth = getGoogleAuth()
  const sheets = google.sheets({ version: "v4", auth })

  // Fetch all data from Dashboard sheet
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `'${DASHBOARD_SHEET}'!A:AJ`
  })

  const rows = response.data.values
  if (!rows || rows.length < 2) {
    throw new Error("No data found in Dashboard sheet")
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

  console.log("📝 Column mapping:")
  console.log(`   Ticker: col ${cols.ticker}, Name: col ${cols.name}, BTC: col ${cols.btcHoldings}`)
  console.log(`   Price: col ${cols.price}, mNAV: col ${cols.dilutedMNav}, EV: col ${cols.enterpriseValueUsd}\n`)

  // Parse all rows
  const companiesData: SheetRow[] = []

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i]
    if (!row) continue

    const ticker = parseString(row[cols.ticker])
    const name = parseString(row[cols.name])

    if (!ticker || !name) continue

    companiesData.push({
      rank: parseNumber(row[cols.rank]),
      name,
      ticker,
      btcHoldings: parseNumber(row[cols.btcHoldings]),
      basicMNav: parseNumber(row[cols.basicMNav]),
      dilutedMNav: parseNumber(row[cols.dilutedMNav]),
      price: parseNumber(row[cols.price]),
      priceChange1d: parseNumber(row[cols.priceChange1d]),
      priceAt1xDilutedMNav: parseNumber(row[cols.priceAt1xDilutedMNav]),
      enterpriseValueUsd: parseNumber(row[cols.enterpriseValueUsd]),
      avgVolumeUsd: parseNumber(row[cols.avgVolumeUsd]),
      btcNavUsd: parseNumber(row[cols.btcNavUsd]),
      debtUsd: parseNumber(row[cols.debtUsd]),
      high1y: parseNumber(row[cols.high1y]),
      high1yDelta: parseNumber(row[cols.high1yDelta]),
      avg200d: parseNumber(row[cols.avg200d]),
      avg200dDelta: parseNumber(row[cols.avg200dDelta]),
      insiderBuySellRatio: parseNumber(row[cols.insiderBuySellRatio]),
      cashUsd: parseNumber(row[cols.cashUsd]),
      marketCapUsd: parseNumber(row[cols.marketCapUsd]),
      sharesOutstanding: parseNumber(row[cols.sharesOutstanding]),
      dilutedShares: parseNumber(row[cols.dilutedShares]),
      dilutedMarketCapUsd: parseNumber(row[cols.dilutedMarketCapUsd]),
      dilutedEvUsd: parseNumber(row[cols.dilutedEvUsd]),
      exchange: parseString(row[cols.exchange]),
      avgVolumeShares: parseNumber(row[cols.avgVolumeShares]),
      priceChange5d: parseNumber(row[cols.priceChange5d]),
      priceChange1m: parseNumber(row[cols.priceChange1m]),
      priceChangeYtd: parseNumber(row[cols.priceChangeYtd]),
      priceChange1y: parseNumber(row[cols.priceChange1y]),
      currencyCode: parseString(row[cols.currencyCode]),
      conversionRate: parseNumber(row[cols.conversionRate]),
      region: parseString(row[cols.region]),
      subRegion: parseString(row[cols.subRegion]),
      category: parseString(row[cols.category])
    })
  }

  console.log(`📊 Found ${companiesData.length} companies in sheet\n`)

  // Upsert companies (update existing by ticker, insert new)
  let updated = 0
  let inserted = 0
  for (const data of companiesData) {
    try {
      // Check if company exists
      const [existing] = await db
        .select()
        .from(companies)
        .where(eq(companies.ticker, data.ticker))
        .limit(1)

      const companyData = {
        rank: data.rank,
        name: data.name,
        yahooTicker: data.ticker, // Use ticker as default
        exchange: data.exchange,
        currencyCode: data.currencyCode || "USD",
        conversionRate: data.conversionRate,
        region: data.region,
        subRegion: data.subRegion,
        category: data.category,
        btcHoldings: data.btcHoldings,
        price: data.price,
        priceChange1d: data.priceChange1d,
        marketCapUsd: data.marketCapUsd,
        sharesOutstanding: data.sharesOutstanding,
        dilutedShares: data.dilutedShares,
        dilutedMarketCapUsd: data.dilutedMarketCapUsd,
        basicMNav: data.basicMNav,
        dilutedMNav: data.dilutedMNav,
        priceAt1xDilutedMNav: data.priceAt1xDilutedMNav,
        enterpriseValueUsd: data.enterpriseValueUsd,
        dilutedEvUsd: data.dilutedEvUsd,
        btcNavUsd: data.btcNavUsd,
        debtUsd: data.debtUsd,
        cashUsd: data.cashUsd,
        avgVolumeUsd: data.avgVolumeUsd,
        avgVolumeShares: data.avgVolumeShares,
        high1y: data.high1y,
        high1yDelta: data.high1yDelta,
        avg200d: data.avg200d,
        avg200dDelta: data.avg200dDelta,
        priceChange5d: data.priceChange5d,
        priceChange1m: data.priceChange1m,
        priceChangeYtd: data.priceChangeYtd,
        priceChange1y: data.priceChange1y,
        insiderBuySellRatio: data.insiderBuySellRatio,
        lastSyncedAt: new Date(),
        syncSource: "Google Sheets sync",
        updatedAt: new Date()
      }

      if (existing) {
        // PROTECTION: Only update fields that have valid values
        // This prevents null values from overwriting good existing data
        const safeCompanyData = filterNullValues(companyData)

        // Always update these metadata fields
        safeCompanyData.lastSyncedAt = new Date()
        safeCompanyData.syncSource = "Google Sheets sync"
        safeCompanyData.updatedAt = new Date()

        await db
          .update(companies)
          .set(safeCompanyData)
          .where(eq(companies.id, existing.id))
        updated++
        console.log(`🔄 Updated: ${data.ticker.padEnd(12)} | ${data.name.slice(0, 30).padEnd(30)} | BTC: ${data.btcHoldings?.padStart(12) ?? "N/A".padStart(12)}`)
      } else {
        // Insert new company (include all data for new records)
        await db.insert(companies).values({
          ...companyData,
          ticker: data.ticker
        })
        inserted++
        console.log(`✅ Inserted: ${data.ticker.padEnd(12)} | ${data.name.slice(0, 30).padEnd(30)} | BTC: ${data.btcHoldings?.padStart(12) ?? "N/A".padStart(12)}`)
      }
    } catch (error) {
      console.log(`❌ Failed: ${data.ticker} - ${error instanceof Error ? error.message : "Unknown error"}`)
    }
  }

  console.log(`\n📊 Sync Summary:`)
  console.log(`   🔄 Updated: ${updated}`)
  console.log(`   ✅ Inserted: ${inserted}`)
  console.log(`   📊 Total in sheet: ${companiesData.length}`)
  console.log(`\n✨ Sync complete!`)

  await client.end()
  process.exit(0)
}

syncFromSheets().catch(error => {
  console.error("❌ Sync failed:", error)
  process.exit(1)
})
