import { config } from "dotenv"
import { drizzle } from "drizzle-orm/postgres-js"
import postgres from "postgres"
import { companies } from "../schema/companies"

config({ path: ".env.local" })

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) {
  throw new Error("DATABASE_URL is not set")
}

const client = postgres(databaseUrl, { prepare: false })
const db = drizzle(client)

// Treasury companies data based on Bitcoin Treasuries list
const treasuryCompanies = [
  {
    name: "MicroStrategy",
    ticker: "MSTR",
    yahooTicker: "MSTR",
    exchange: "NASDAQ",
    tradingCurrency: "USD" as const,
    country: "USA",
    sector: "Software",
    website: "https://www.microstrategy.com",
    description:
      "Enterprise analytics and mobility software company, now primarily known as a Bitcoin treasury company.",
    btcHoldings: "478740",
    sharesOutstanding: "244820000"
  },
  {
    name: "Marathon Digital Holdings",
    ticker: "MARA",
    yahooTicker: "MARA",
    exchange: "NASDAQ",
    tradingCurrency: "USD" as const,
    country: "USA",
    sector: "Bitcoin Mining",
    website: "https://www.mara.com",
    description:
      "One of the largest Bitcoin mining companies in North America.",
    btcHoldings: "46376",
    sharesOutstanding: "350000000"
  },
  {
    name: "Riot Platforms",
    ticker: "RIOT",
    yahooTicker: "RIOT",
    exchange: "NASDAQ",
    tradingCurrency: "USD" as const,
    country: "USA",
    sector: "Bitcoin Mining",
    website: "https://www.riotplatforms.com",
    description: "Bitcoin mining and infrastructure company.",
    btcHoldings: "18692",
    sharesOutstanding: "420000000"
  },
  {
    name: "Coinbase Global",
    ticker: "COIN",
    yahooTicker: "COIN",
    exchange: "NASDAQ",
    tradingCurrency: "USD" as const,
    country: "USA",
    sector: "Crypto Exchange",
    website: "https://www.coinbase.com",
    description: "Largest cryptocurrency exchange in the United States.",
    btcHoldings: "9480",
    sharesOutstanding: "250000000"
  },
  {
    name: "Tesla",
    ticker: "TSLA",
    yahooTicker: "TSLA",
    exchange: "NASDAQ",
    tradingCurrency: "USD" as const,
    country: "USA",
    sector: "Automotive",
    website: "https://www.tesla.com",
    description: "Electric vehicle and clean energy company.",
    btcHoldings: "9720",
    sharesOutstanding: "3180000000"
  },
  {
    name: "Block Inc",
    ticker: "SQ",
    yahooTicker: "SQ",
    exchange: "NYSE",
    tradingCurrency: "USD" as const,
    country: "USA",
    sector: "Fintech",
    website: "https://www.block.xyz",
    description:
      "Financial services and digital payments company, formerly Square.",
    btcHoldings: "8027",
    sharesOutstanding: "600000000"
  },
  {
    name: "Hut 8 Corp",
    ticker: "HUT",
    yahooTicker: "HUT",
    exchange: "NASDAQ",
    tradingCurrency: "USD" as const,
    country: "Canada",
    sector: "Bitcoin Mining",
    website: "https://www.hut8.com",
    description:
      "Bitcoin mining and high-performance computing infrastructure company.",
    btcHoldings: "10096",
    sharesOutstanding: "100000000"
  },
  {
    name: "CleanSpark",
    ticker: "CLSK",
    yahooTicker: "CLSK",
    exchange: "NASDAQ",
    tradingCurrency: "USD" as const,
    country: "USA",
    sector: "Bitcoin Mining",
    website: "https://www.cleanspark.com",
    description:
      "Bitcoin mining company focused on sustainable energy solutions.",
    btcHoldings: "10556",
    sharesOutstanding: "300000000"
  },
  {
    name: "Metaplanet",
    ticker: "3350",
    yahooTicker: "3350.T",
    exchange: "TSE",
    tradingCurrency: "JPY" as const,
    country: "Japan",
    sector: "Investment",
    website: "https://metaplanet.jp",
    description: "Japanese investment company with Bitcoin treasury strategy.",
    btcHoldings: "1762",
    sharesOutstanding: "1000000000"
  },
  {
    name: "Semler Scientific",
    ticker: "SMLR",
    yahooTicker: "SMLR",
    exchange: "NASDAQ",
    tradingCurrency: "USD" as const,
    country: "USA",
    sector: "Healthcare",
    website: "https://www.semlerscientific.com",
    description:
      "Healthcare company providing technology solutions and holding Bitcoin.",
    btcHoldings: "3192",
    sharesOutstanding: "7000000"
  },
  {
    name: "Galaxy Digital",
    ticker: "GLXY",
    yahooTicker: "GLXY.TO",
    exchange: "TSX",
    tradingCurrency: "CAD" as const,
    country: "Canada",
    sector: "Crypto Finance",
    website: "https://www.galaxy.com",
    description:
      "Financial services and investment management company in the digital asset space.",
    btcHoldings: "8100",
    sharesOutstanding: "400000000"
  },
  {
    name: "Bitdeer Technologies",
    ticker: "BTDR",
    yahooTicker: "BTDR",
    exchange: "NASDAQ",
    tradingCurrency: "USD" as const,
    country: "Singapore",
    sector: "Bitcoin Mining",
    website: "https://www.bitdeer.com",
    description:
      "Technology company for cryptocurrency mining and data center operations.",
    btcHoldings: "1012",
    sharesOutstanding: "200000000"
  },
  {
    name: "KULR Technology Group",
    ticker: "KULR",
    yahooTicker: "KULR",
    exchange: "NYSE",
    tradingCurrency: "USD" as const,
    country: "USA",
    sector: "Technology",
    website: "https://www.kulrtechnology.com",
    description:
      "Energy management company with thermal management solutions and Bitcoin treasury.",
    btcHoldings: "510",
    sharesOutstanding: "200000000"
  },
  {
    name: "Genius Group",
    ticker: "GNS",
    yahooTicker: "GNS",
    exchange: "NYSE",
    tradingCurrency: "USD" as const,
    country: "Singapore",
    sector: "EdTech",
    website: "https://www.geniusgroup.net",
    description:
      "Education technology company with Bitcoin treasury strategy.",
    btcHoldings: "440",
    sharesOutstanding: "100000000"
  },
  {
    name: "Fold Holdings",
    ticker: "FLD",
    yahooTicker: "FLD",
    exchange: "NASDAQ",
    tradingCurrency: "USD" as const,
    country: "USA",
    sector: "Fintech",
    website: "https://www.fold.app",
    description:
      "Bitcoin rewards and payments company with treasury holdings.",
    btcHoldings: "1260",
    sharesOutstanding: "50000000"
  }
]

async function seedCompanies() {
  console.log("Seeding treasury companies...")

  for (const company of treasuryCompanies) {
    try {
      await db
        .insert(companies)
        .values({
          name: company.name,
          ticker: company.ticker,
          yahooTicker: company.yahooTicker,
          exchange: company.exchange,
          tradingCurrency: company.tradingCurrency,
          country: company.country,
          sector: company.sector,
          website: company.website,
          description: company.description,
          btcHoldings: company.btcHoldings,
          sharesOutstanding: company.sharesOutstanding,
          btcHoldingsDate: new Date(),
          btcHoldingsSource: "Initial seed data",
          status: "active",
          isTracked: true
        })
        .onConflictDoNothing()

      console.log(`✓ Seeded: ${company.name} (${company.ticker})`)
    } catch (error) {
      console.error(`✗ Error seeding ${company.name}:`, error)
    }
  }

  console.log("\nSeeding complete!")
  process.exit(0)
}

seedCompanies()
