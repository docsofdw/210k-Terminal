import { db } from "@/db"
import { companies } from "@/db/schema/companies"
import { stockPrices } from "@/db/schema/stock-prices"
import { getMultipleQuotes } from "@/lib/api/yahoo-finance"
import { adjustQuoteForPence } from "@/lib/utils/currency"
import { eq } from "drizzle-orm"
import { NextRequest, NextResponse } from "next/server"

export const dynamic = "force-dynamic"
export const maxDuration = 60

export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    // Get all active tracked companies
    const activeCompanies = await db
      .select({
        id: companies.id,
        ticker: companies.ticker,
        yahooTicker: companies.yahooTicker,
        tradingCurrency: companies.tradingCurrency
      })
      .from(companies)
      .where(eq(companies.isTracked, true))

    if (activeCompanies.length === 0) {
      return NextResponse.json({ message: "No companies to update" })
    }

    // Get quotes from Yahoo Finance
    const symbols = activeCompanies.map(c => c.yahooTicker)
    const quotes = await getMultipleQuotes(symbols)

    // Insert price records
    const insertPromises = activeCompanies.map(async company => {
      const quote = quotes.get(company.yahooTicker)
      if (!quote) {
        console.log(`No quote for ${company.yahooTicker}`)
        return null
      }

      // Adjust for LSE pence pricing (stocks ending in .L are quoted in pence)
      const adjustedQuote = adjustQuoteForPence(quote, company.yahooTicker)

      return db.insert(stockPrices).values({
        companyId: company.id,
        price: adjustedQuote.price.toString(),
        open: adjustedQuote.open?.toString() ?? null,
        high: adjustedQuote.high?.toString() ?? null,
        low: adjustedQuote.low?.toString() ?? null,
        close: adjustedQuote.previousClose?.toString() ?? null,
        volume: quote.volume?.toString() ?? null,
        marketCapUsd: quote.marketCap?.toString() ?? null,
        priceAt: quote.timestamp
      })
    })

    const results = await Promise.all(insertPromises)
    const successCount = results.filter(r => r !== null).length

    return NextResponse.json({
      success: true,
      updated: successCount,
      total: activeCompanies.length,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error("Stock prices cron error:", error)
    return NextResponse.json(
      { error: "Failed to update stock prices" },
      { status: 500 }
    )
  }
}
