import { config } from "dotenv"
import { drizzle } from "drizzle-orm/postgres-js"
import postgres from "postgres"
import { companies } from "../schema/companies"
import { sql } from "drizzle-orm"

config({ path: ".env.local" })

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) {
  throw new Error("DATABASE_URL is not set")
}

const client = postgres(databaseUrl, { prepare: false })
const db = drizzle(client)

// 15 Treasury companies from COMPANIES.md
const treasuryCompanies = [
  {
    name: "American Bitcoin Corp.",
    ticker: "ABTC",
    yahooTicker: "ABTC",
    exchange: "NASDAQ",
    tradingCurrency: "USD" as const,
    country: "USA",
    sector: "Bitcoin Treasury"
  },
  {
    name: "Bitcoin Treasury Corporation",
    ticker: "BTCT.V",
    yahooTicker: "BTCT.V",
    exchange: "TSX-V",
    tradingCurrency: "CAD" as const,
    country: "Canada",
    sector: "Bitcoin Treasury"
  },
  {
    name: "Oranje S.A.",
    ticker: "OBTC3",
    yahooTicker: "OBTC3.SA",
    exchange: "B3",
    tradingCurrency: "BRL" as const,
    country: "Brazil",
    sector: "Bitcoin Treasury"
  },
  {
    name: "DigitalX Limited",
    ticker: "DCC.AX",
    yahooTicker: "DCC.AX",
    exchange: "ASX",
    tradingCurrency: "AUD" as const,
    country: "Australia",
    sector: "Digital Assets"
  },
  {
    name: "Aifinyo AG",
    ticker: "EBEN.HM",
    yahooTicker: "AIYN.F",
    exchange: "Hamburg",
    tradingCurrency: "EUR" as const,
    country: "Germany",
    sector: "Fintech"
  },
  {
    name: "Treasury BV",
    ticker: "TRSR",
    yahooTicker: "TRSR",
    exchange: "Private",
    tradingCurrency: "EUR" as const,
    country: "Netherlands",
    sector: "Bitcoin Treasury",
    isTracked: false
  },
  {
    name: "Metaplanet Inc.",
    ticker: "3350.T",
    yahooTicker: "3350.T",
    exchange: "Tokyo",
    tradingCurrency: "JPY" as const,
    country: "Japan",
    sector: "Investment"
  },
  {
    name: "Matador Technologies Inc.",
    ticker: "MATA.V",
    yahooTicker: "MATA.V",
    exchange: "CSE",
    tradingCurrency: "CAD" as const,
    country: "Canada",
    sector: "Technology"
  },
  {
    name: "Moon Inc",
    ticker: "1723.HK",
    yahooTicker: "1723.HK",
    exchange: "HKEX",
    tradingCurrency: "HKD" as const,
    country: "Hong Kong",
    sector: "Investment"
  },
  {
    name: "DV8 Public Company Limited",
    ticker: "DV8.BK",
    yahooTicker: "DV8.BK",
    exchange: "SET",
    tradingCurrency: "THB" as const,
    country: "Thailand",
    sector: "Technology"
  },
  {
    name: "The Smarter Web Company Plc",
    ticker: "SWC.AQ",
    yahooTicker: "SWC.L",
    exchange: "Aquis",
    tradingCurrency: "GBP" as const,
    country: "UK",
    sector: "Technology"
  },
  {
    name: "Capital B",
    ticker: "ALCPB.PA",
    yahooTicker: "ALCPB.PA",
    exchange: "Euronext",
    tradingCurrency: "EUR" as const,
    country: "France",
    sector: "Investment"
  },
  {
    name: "Satsuma Technology Plc",
    ticker: "SATS.L",
    yahooTicker: "SATS.L",
    exchange: "LSE",
    tradingCurrency: "GBP" as const,
    country: "UK",
    sector: "Technology"
  },
  {
    name: "Bitplanet Inc.",
    ticker: "049470.KQ",
    yahooTicker: "049470.KQ",
    exchange: "KOSDAQ",
    tradingCurrency: "KRW" as const,
    country: "South Korea",
    sector: "Technology"
  },
  {
    name: "LQWD Technologies Corp.",
    ticker: "LQWD.V",
    yahooTicker: "LQWD.V",
    exchange: "TSX-V",
    tradingCurrency: "CAD" as const,
    country: "Canada",
    sector: "Bitcoin Infrastructure"
  }
]

async function seedCompanies() {
  console.log("Deleting existing companies...")
  await db.delete(companies)
  console.log("✓ Deleted all existing companies")

  console.log("\nSeeding 15 treasury companies from COMPANIES.md...")

  for (const company of treasuryCompanies) {
    try {
      await db.insert(companies).values({
        name: company.name,
        ticker: company.ticker,
        yahooTicker: company.yahooTicker,
        exchange: company.exchange,
        tradingCurrency: company.tradingCurrency,
        country: company.country,
        sector: company.sector,
        status: "active",
        isTracked: company.isTracked ?? true
      })

      console.log(`✓ Seeded: ${company.name} (${company.ticker})`)
    } catch (error) {
      console.error(`✗ Error seeding ${company.name}:`, error)
    }
  }

  console.log("\nSeeding complete! 15 companies added.")
  process.exit(0)
}

seedCompanies()
