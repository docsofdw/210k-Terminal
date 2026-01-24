"use server"

import { google } from "googleapis"

// Sheet configuration
const SPREADSHEET_ID = "1fNQGJIaDT3czM7Bqd9dZ6WTJYk-54niL9F3Pe9zYgpQ"
const COMPS_TABLE_SHEET = "Comps Table"

export interface SheetCompanyData {
  ticker: string
  name: string
  price: number | null
  btcHoldings: number | null
  sharesOutstanding: number | null
  marketCapUsd: number | null
  evUsd: number | null
  btcNav: number | null
  mNav: number | null
  debtUsd: number | null
  cashUsd: number | null
  preferredsUsd: number | null
  satsPerShare: number | null
  btcPerShare: number | null
  change24h: number | null
}

export interface SheetDataResult {
  companies: SheetCompanyData[]
  btcPrice: number | null
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

export async function getCompsTableData(): Promise<SheetDataResult | null> {
  const auth = getGoogleAuth()

  if (!auth) {
    return null
  }

  try {
    const sheets = google.sheets({ version: "v4", auth })

    // Fetch the Comps Table data
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `'${COMPS_TABLE_SHEET}'!A:Z`
    })

    const rows = response.data.values

    if (!rows || rows.length < 2) {
      console.error("No data found in Comps Table sheet")
      return null
    }

    // First row is headers
    const headers = rows[0].map((h: string) => h?.toLowerCase().trim() || "")

    // Find column indices
    const colIndex = (name: string) => {
      const variations = [name, name.replace(/_/g, " "), name.replace(/ /g, "_")]
      for (const v of variations) {
        const idx = headers.findIndex((h: string) => h.includes(v.toLowerCase()))
        if (idx !== -1) return idx
      }
      return -1
    }

    const tickerCol = colIndex("ticker")
    const nameCol = colIndex("name") !== -1 ? colIndex("name") : colIndex("company")
    const priceCol = colIndex("price")
    const btcHoldingsCol = colIndex("btc") !== -1 ? colIndex("btc") : colIndex("holdings")
    const sharesCol = colIndex("shares")
    const marketCapCol = colIndex("market cap") !== -1 ? colIndex("market cap") : colIndex("mkt cap")
    const evCol = colIndex("ev")
    const btcNavCol = colIndex("btc nav") !== -1 ? colIndex("btc nav") : colIndex("nav")
    const mNavCol = colIndex("mnav")
    const debtCol = colIndex("debt")
    const cashCol = colIndex("cash")
    const preferredsCol = colIndex("preferreds") !== -1 ? colIndex("preferreds") : colIndex("pref")
    const satsPerShareCol = colIndex("sats")
    const btcPerShareCol = colIndex("btc/share") !== -1 ? colIndex("btc/share") : colIndex("btc per share")
    const changeCol = colIndex("change") !== -1 ? colIndex("change") : colIndex("24h")

    // Parse data rows
    const companies: SheetCompanyData[] = []

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i]
      if (!row || !row[tickerCol]) continue

      const parseNum = (val: string | undefined): number | null => {
        if (!val) return null
        const cleaned = val.toString().replace(/[$,%,\s]/g, "").replace(/[()]/g, "-")
        const num = parseFloat(cleaned)
        return isNaN(num) ? null : num
      }

      companies.push({
        ticker: row[tickerCol]?.toString().trim() || "",
        name: row[nameCol]?.toString().trim() || "",
        price: parseNum(row[priceCol]),
        btcHoldings: parseNum(row[btcHoldingsCol]),
        sharesOutstanding: parseNum(row[sharesCol]),
        marketCapUsd: parseNum(row[marketCapCol]),
        evUsd: parseNum(row[evCol]),
        btcNav: parseNum(row[btcNavCol]),
        mNav: parseNum(row[mNavCol]),
        debtUsd: parseNum(row[debtCol]),
        cashUsd: parseNum(row[cashCol]),
        preferredsUsd: parseNum(row[preferredsCol]),
        satsPerShare: parseNum(row[satsPerShareCol]),
        btcPerShare: parseNum(row[btcPerShareCol]),
        change24h: parseNum(row[changeCol])
      })
    }

    // Try to extract BTC price from a cell (often in a header area)
    let btcPrice: number | null = null
    const btcPriceCell = rows.find((row: string[]) =>
      row.some((cell: string) => cell?.toString().toLowerCase().includes("btc price"))
    )
    if (btcPriceCell) {
      const priceIdx = btcPriceCell.findIndex((cell: string) =>
        cell?.toString().toLowerCase().includes("btc price")
      )
      if (priceIdx !== -1 && btcPriceCell[priceIdx + 1]) {
        const priceStr = btcPriceCell[priceIdx + 1].toString().replace(/[$,]/g, "")
        btcPrice = parseFloat(priceStr) || null
      }
    }

    return {
      companies: companies.filter(c => c.ticker),
      btcPrice,
      lastUpdated: new Date(),
      source: "google_sheets"
    }
  } catch (error) {
    console.error("Error fetching Google Sheets data:", error)
    return null
  }
}

export async function getSheetDataAsBackup(): Promise<Map<string, SheetCompanyData> | null> {
  const data = await getCompsTableData()

  if (!data) {
    return null
  }

  const map = new Map<string, SheetCompanyData>()
  for (const company of data.companies) {
    map.set(company.ticker.toUpperCase(), company)
  }

  return map
}
