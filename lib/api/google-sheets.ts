"use server"

import { google } from "googleapis"

// New BTCTCs Master Sheet configuration
const SPREADSHEET_ID = "1_whntepzncCFsn-K1oyL5Epqh5D6mauAOnb_Zs7svkk"
const DASHBOARD_SHEET = "Dashboard"

export interface SheetCompanyData {
  // Basic Info
  rank: number | null
  name: string
  ticker: string

  // Core Metrics
  btcHoldings: number | null
  basicMNav: number | null
  dilutedMNav: number | null
  mNav: number | null  // Legacy alias for dilutedMNav
  price: number | null
  priceChange1d: number | null
  priceAt1xDilutedMNav: number | null

  // Valuation
  enterpriseValueUsd: number | null
  avgVolumeUsd: number | null
  btcNavUsd: number | null
  debtUsd: number | null

  // Price History
  high1y: number | null
  high1yDelta: number | null
  avg200d: number | null
  avg200dDelta: number | null

  // Other
  insiderBuySellRatio: number | null
  cashUsd: number | null
  marketCapUsd: number | null
  sharesOutstanding: number | null
  dilutedShares: number | null
  dilutedMarketCapUsd: number | null
  dilutedEvUsd: number | null
  exchange: string | null
  avgVolumeShares: number | null

  // Performance
  priceChange5d: number | null
  priceChange1m: number | null
  priceChangeYtd: number | null
  priceChange1y: number | null

  // Classification
  currencyCode: string | null
  conversionRate: number | null
  region: string | null
  subRegion: string | null
  category: string | null
}

export interface SheetDataResult {
  companies: SheetCompanyData[]
  btcPrice: number | null  // Legacy field for backward compatibility
  lastUpdated: Date
  source: "google_sheets"
}

function getGoogleAuth() {
  const credentials = process.env.GOOGLE_SERVICE_ACCOUNT_KEY

  if (!credentials) {
    console.error("GOOGLE_SERVICE_ACCOUNT_KEY not set")
    return null
  }

  try {
    const parsed = JSON.parse(credentials)
    return new google.auth.GoogleAuth({
      credentials: parsed,
      scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"]
    })
  } catch (error) {
    console.error("Error parsing Google credentials:", error)
    return null
  }
}

function parseNumber(val: string | undefined | null): number | null {
  if (val === undefined || val === null || val === "") return null
  const cleaned = val
    .toString()
    .replace(/[$€£¥₩฿,\s%]/g, "")
    .replace(/[()]/g, "-")
    .trim()

  if (cleaned === "" || cleaned === "-" || cleaned === "N/A") return null

  const num = parseFloat(cleaned)
  return isNaN(num) ? null : num
}

function parseString(val: string | undefined | null): string | null {
  if (val === undefined || val === null) return null
  const str = val.toString().trim()
  return str === "" || str === "N/A" ? null : str
}

export async function getDashboardData(): Promise<SheetDataResult | null> {
  const auth = getGoogleAuth()

  if (!auth) {
    return null
  }

  try {
    const sheets = google.sheets({ version: "v4", auth })

    // Fetch the Dashboard data - extended range to capture all columns
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `'${DASHBOARD_SHEET}'!A:AJ`
    })

    const rows = response.data.values

    if (!rows || rows.length < 2) {
      console.error("No data found in Dashboard sheet")
      return null
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

    // Map columns based on header names
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

    // Parse data rows (skip header)
    const companies: SheetCompanyData[] = []

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i]
      if (!row) continue

      const ticker = parseString(row[cols.ticker])
      const name = parseString(row[cols.name])

      // Skip rows without ticker or name
      if (!ticker && !name) continue

      const dilutedMNavValue = parseNumber(row[cols.dilutedMNav])
      companies.push({
        rank: parseNumber(row[cols.rank]),
        name: name || "",
        ticker: ticker || "",
        btcHoldings: parseNumber(row[cols.btcHoldings]),
        basicMNav: parseNumber(row[cols.basicMNav]),
        dilutedMNav: dilutedMNavValue,
        mNav: dilutedMNavValue,  // Legacy alias
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

    return {
      companies: companies.filter(c => c.ticker),
      btcPrice: null,  // BTC price is now fetched separately via btc-prices cron
      lastUpdated: new Date(),
      source: "google_sheets"
    }
  } catch (error) {
    console.error("Error fetching Google Sheets data:", error)
    return null
  }
}

// Legacy function for backward compatibility
export async function getCompsTableData(): Promise<SheetDataResult | null> {
  return getDashboardData()
}

export async function getSheetDataAsBackup(): Promise<Map<string, SheetCompanyData> | null> {
  const data = await getDashboardData()

  if (!data) {
    return null
  }

  const map = new Map<string, SheetCompanyData>()
  for (const company of data.companies) {
    map.set(company.ticker.toUpperCase(), company)
  }

  return map
}
