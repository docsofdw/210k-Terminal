import { db } from "@/db"
import { companies } from "@/db/schema/companies"
import { stockPrices } from "@/db/schema/stock-prices"
import { dailySnapshots } from "@/db/schema/daily-snapshots"
import { btcPrices } from "@/db/schema/btc-prices"
import { fxRates } from "@/db/schema/fx-rates"
import { getMultipleQuotes } from "@/lib/api/yahoo-finance"
import { adjustQuoteForPence } from "@/lib/utils/currency"
import { eq, desc, and, gte, lte } from "drizzle-orm"
import { NextRequest, NextResponse } from "next/server"

export const dynamic = "force-dynamic"
export const maxDuration = 120

// Normalize date to midnight UTC
function normalizeDate(date: Date): Date {
  const normalized = new Date(date)
  normalized.setUTCHours(0, 0, 0, 0)
  return normalized
}

export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const now = new Date()
    const today = normalizeDate(now)

    // Get all active tracked companies
    const activeCompanies = await db
      .select()
      .from(companies)
      .where(eq(companies.isTracked, true))

    if (activeCompanies.length === 0) {
      return NextResponse.json({ message: "No companies to update" })
    }

    // Get quotes from Yahoo Finance
    const symbols = activeCompanies.map(c => c.yahooTicker)
    const quotes = await getMultipleQuotes(symbols)

    // Get latest BTC price
    const latestBtcPrice = await db.query.btcPrices.findFirst({
      orderBy: [desc(btcPrices.priceAt)]
    })
    const btcPrice = latestBtcPrice ? parseFloat(latestBtcPrice.priceUsd) : null

    // Get FX rates
    const allFxRates = await db.select().from(fxRates).orderBy(desc(fxRates.rateAt))
    const fxRateMap = new Map<string, number>()
    const seenCurrencies = new Set<string>()
    for (const rate of allFxRates) {
      if (!seenCurrencies.has(rate.currency)) {
        fxRateMap.set(rate.currency, parseFloat(rate.rateToUsd))
        seenCurrencies.add(rate.currency)
      }
    }

    let stockPricesUpdated = 0
    let snapshotsUpdated = 0

    for (const company of activeCompanies) {
      const quote = quotes.get(company.yahooTicker)
      if (!quote) {
        console.log(`No quote for ${company.yahooTicker}`)
        continue
      }

      // Adjust for LSE pence pricing (stocks ending in .L are quoted in pence)
      const adjustedQuote = adjustQuoteForPence(quote, company.yahooTicker)

      // Insert into stock_prices table (in local currency)
      await db.insert(stockPrices).values({
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
      stockPricesUpdated++

      // Also update/upsert today's daily snapshot for real-time chart updates
      if (btcPrice) {
        const fxRate = fxRateMap.get(company.tradingCurrency) || 1
        const stockPriceUsd = adjustedQuote.price / fxRate

        // Parse company financial data
        const btcHoldings = company.btcHoldings
          ? parseFloat(company.btcHoldings)
          : null
        const sharesOutstanding = company.sharesOutstanding
          ? parseFloat(company.sharesOutstanding)
          : null
        const cashUsd = company.cashUsd ? parseFloat(company.cashUsd) : 0
        const debtUsd = company.debtUsd ? parseFloat(company.debtUsd) : 0
        const preferredsUsd = company.preferredsUsd
          ? parseFloat(company.preferredsUsd)
          : 0

        // Calculate metrics
        const marketCapUsd =
          stockPriceUsd && sharesOutstanding
            ? stockPriceUsd * sharesOutstanding
            : null

        const btcNav = btcHoldings ? btcHoldings * btcPrice : null

        const evUsd = marketCapUsd
          ? marketCapUsd + debtUsd + preferredsUsd - cashUsd
          : null

        let mNav: number | null = null
        if (evUsd && btcNav && btcNav > 0) {
          mNav = evUsd / btcNav
        }

        const satsPerShare =
          btcHoldings && sharesOutstanding
            ? (btcHoldings * 100_000_000) / sharesOutstanding
            : null

        const btcPerShare =
          btcHoldings && sharesOutstanding ? btcHoldings / sharesOutstanding : null

        // Check if we have a snapshot for today
        const existingSnapshot = await db.query.dailySnapshots.findFirst({
          where: and(
            eq(dailySnapshots.companyId, company.id),
            gte(dailySnapshots.snapshotDate, today),
            lte(dailySnapshots.snapshotDate, new Date(today.getTime() + 24 * 60 * 60 * 1000))
          )
        })

        if (existingSnapshot) {
          // Update existing snapshot with latest price
          await db
            .update(dailySnapshots)
            .set({
              stockPrice: adjustedQuote.price.toString(),
              stockPriceUsd: stockPriceUsd.toString(),
              marketCapUsd: marketCapUsd?.toString() ?? null,
              btcPrice: btcPrice.toString(),
              btcNav: btcNav?.toString() ?? null,
              evUsd: evUsd?.toString() ?? null,
              mNav: mNav?.toString() ?? null,
              satsPerShare: satsPerShare?.toString() ?? null,
              btcPerShare: btcPerShare?.toString() ?? null,
              dataSource: "hourly_update"
            })
            .where(eq(dailySnapshots.id, existingSnapshot.id))
          snapshotsUpdated++
        } else {
          // Create new snapshot for today
          await db.insert(dailySnapshots).values({
            snapshotDate: today,
            companyId: company.id,
            ticker: company.ticker,
            companyName: company.name,
            stockPrice: adjustedQuote.price.toString(),
            stockPriceUsd: stockPriceUsd.toString(),
            marketCapUsd: marketCapUsd?.toString() ?? null,
            btcPrice: btcPrice.toString(),
            btcHoldings: btcHoldings?.toString() ?? null,
            btcNav: btcNav?.toString() ?? null,
            evUsd: evUsd?.toString() ?? null,
            mNav: mNav?.toString() ?? null,
            satsPerShare: satsPerShare?.toString() ?? null,
            btcPerShare: btcPerShare?.toString() ?? null,
            sharesOutstanding: sharesOutstanding?.toString() ?? null,
            cashUsd: cashUsd.toString(),
            debtUsd: debtUsd.toString(),
            preferredsUsd: preferredsUsd.toString(),
            fxRate: fxRate.toString(),
            tradingCurrency: company.tradingCurrency,
            dataSource: "hourly_update"
          })
          snapshotsUpdated++
        }
      }
    }

    return NextResponse.json({
      success: true,
      stockPricesUpdated,
      snapshotsUpdated,
      companiesTotal: activeCompanies.length,
      btcPrice,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error("Hourly stock prices cron error:", error)
    return NextResponse.json(
      { error: "Failed to update stock prices" },
      { status: 500 }
    )
  }
}
