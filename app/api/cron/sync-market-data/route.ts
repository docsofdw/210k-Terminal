/**
 * Sync Market Data Cron Job
 *
 * Fetches stock quotes from MarketData.app (US) and Yahoo Finance (International)
 * and updates the companies table with fresh prices and calculated metrics.
 *
 * Fallback: If API fails for a company, falls back to Google Sheets data.
 *
 * Schedule: Every 15 minutes
 * Endpoint: /api/cron/sync-market-data
 */

import { db } from "@/db"
import { companies } from "@/db/schema/companies"
import { fetchQuotesBatch, type CompanyTicker } from "@/lib/services/market-data-service"
import {
  calculateMetrics,
  getLatestBtcPrice,
  calculateHighDelta,
  calculateAvgDelta
} from "@/lib/services/calculation-service"
import { getSheetDataAsBackup, type SheetCompanyData } from "@/lib/api/google-sheets"
import { NextRequest, NextResponse } from "next/server"
import { eq } from "drizzle-orm"

export const dynamic = "force-dynamic"
export const maxDuration = 120 // 2 minutes for batch processing

export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Check for feature flag (allows gradual rollout)
  if (process.env.USE_LEGACY_SHEETS_SYNC === "true") {
    return NextResponse.json({
      success: true,
      skipped: true,
      reason: "Legacy sheets sync enabled, market data sync disabled"
    })
  }

  try {
    // Get current BTC price
    const btcPrice = await getLatestBtcPrice()
    if (btcPrice === 0) {
      return NextResponse.json(
        { error: "No BTC price available" },
        { status: 500 }
      )
    }

    // Get all tracked companies with their tickers
    const allCompanies = await db
      .select({
        id: companies.id,
        ticker: companies.ticker,
        yahooTicker: companies.yahooTicker,
        exchange: companies.exchange,
        currencyCode: companies.currencyCode,
        conversionRate: companies.conversionRate,
        btcHoldings: companies.btcHoldings,
        cashUsd: companies.cashUsd,
        debtUsd: companies.debtUsd,
        preferredsUsd: companies.preferredsUsd,
        sharesOutstanding: companies.sharesOutstanding,
        dilutedShares: companies.dilutedShares,
        high1y: companies.high1y,
        avg200d: companies.avg200d
      })
      .from(companies)
      .where(eq(companies.isTracked, true))

    if (allCompanies.length === 0) {
      return NextResponse.json({
        success: true,
        updated: 0,
        message: "No tracked companies found"
      })
    }

    // Prepare ticker list for batch fetch
    const tickerList: CompanyTicker[] = allCompanies.map(c => ({
      ticker: c.yahooTicker || c.ticker,
      exchange: c.exchange
    }))

    // Fetch quotes from both APIs in parallel
    console.log(`[sync-market-data] Fetching quotes for ${tickerList.length} companies...`)
    const quotes = await fetchQuotesBatch(tickerList)
    console.log(`[sync-market-data] Received ${quotes.size} quotes`)

    // Track companies that need fallback
    const companiesNeedingFallback: typeof allCompanies = []

    // First pass: identify companies without API quotes
    for (const company of allCompanies) {
      const ticker = company.yahooTicker || company.ticker
      const quote = quotes.get(ticker) || quotes.get(ticker.split(".")[0])
      if (!quote) {
        companiesNeedingFallback.push(company)
      }
    }

    // Fetch Google Sheets backup data if needed
    let sheetsBackup: Map<string, SheetCompanyData> | null = null
    if (companiesNeedingFallback.length > 0) {
      console.log(`[sync-market-data] ${companiesNeedingFallback.length} companies need fallback, fetching from Google Sheets...`)
      sheetsBackup = await getSheetDataAsBackup()
      if (sheetsBackup) {
        console.log(`[sync-market-data] Google Sheets backup loaded with ${sheetsBackup.size} companies`)
      } else {
        console.warn(`[sync-market-data] Failed to load Google Sheets backup`)
      }
    }

    // Update each company
    let updated = 0
    let errors = 0
    let skipped = 0
    let fallbackUsed = 0
    const errorDetails: string[] = []
    const fallbackTickers: string[] = []

    for (const company of allCompanies) {
      const ticker = company.yahooTicker || company.ticker
      const quote = quotes.get(ticker) || quotes.get(ticker.split(".")[0])

      // If no API quote, try Google Sheets fallback
      if (!quote) {
        if (sheetsBackup) {
          const sheetData = sheetsBackup.get(company.ticker.toUpperCase())
          if (sheetData && sheetData.price) {
            // Update from Google Sheets
            try {
              await db.update(companies)
                .set({
                  price: sheetData.price.toString(),
                  priceChange1d: sheetData.priceChange1d?.toString() || null,
                  marketCapUsd: sheetData.marketCapUsd?.toString() || null,
                  dilutedMarketCapUsd: sheetData.dilutedMarketCapUsd?.toString() || null,
                  btcNavUsd: sheetData.btcNavUsd?.toString() || null,
                  enterpriseValueUsd: sheetData.enterpriseValueUsd?.toString() || null,
                  dilutedEvUsd: sheetData.dilutedEvUsd?.toString() || null,
                  basicMNav: sheetData.basicMNav?.toString() || null,
                  dilutedMNav: sheetData.dilutedMNav?.toString() || null,
                  priceAt1xDilutedMNav: sheetData.priceAt1xDilutedMNav?.toString() || null,
                  high1y: sheetData.high1y?.toString() || null,
                  avg200d: sheetData.avg200d?.toString() || null,
                  dataSource: "google_sheets_fallback",
                  lastQuoteAt: new Date(),
                  updatedAt: new Date()
                })
                .where(eq(companies.id, company.id))

              fallbackUsed++
              fallbackTickers.push(company.ticker)
              continue
            } catch (err) {
              console.error(`[sync-market-data] Fallback update failed for ${company.ticker}:`, err)
            }
          }
        }
        skipped++
        continue
      }

      const q = quote

      try {
        // Parse existing data
        const btcHoldings = parseFloat(company.btcHoldings || "0")
        const sharesOutstanding = q.sharesOutstanding || parseFloat(company.sharesOutstanding || "0")
        const dilutedShares = parseFloat(company.dilutedShares || "0") || sharesOutstanding
        const cashUsd = parseFloat(company.cashUsd || "0")
        const debtUsd = parseFloat(company.debtUsd || "0")
        const preferredsUsd = parseFloat(company.preferredsUsd || "0")
        const fxRate = parseFloat(company.conversionRate || "1")
        const currency = company.currencyCode || q.currency || "USD"

        // Calculate all metrics
        const metrics = calculateMetrics({
          btcHoldings,
          btcPrice,
          stockPrice: q.price,
          sharesOutstanding,
          dilutedShares,
          marketCapUsd: q.marketCap,
          cashUsd,
          debtUsd,
          preferredsUsd,
          fxRate,
          currency
        })

        // Calculate deltas
        const existing52wHigh = parseFloat(company.high1y || "0")
        const existing200dAvg = parseFloat(company.avg200d || "0")
        const week52High = q.week52High || existing52wHigh
        const high1yDelta = calculateHighDelta(q.price, week52High)
        const avg200dDelta = calculateAvgDelta(q.price, existing200dAvg)

        // Update database
        await db.update(companies)
          .set({
            // Raw quote data
            price: q.price.toString(),
            priceChange1d: q.changePercent.toString(),
            avgVolumeShares: q.volume.toString(),
            high1y: week52High > 0 ? week52High.toString() : null,
            high1yDelta: high1yDelta !== 0 ? high1yDelta.toString() : null,
            avg200dDelta: avg200dDelta !== 0 ? avg200dDelta.toString() : null,

            // Market cap (from API or calculated)
            marketCapUsd: metrics.marketCapUsd.toString(),
            dilutedMarketCapUsd: metrics.dilutedMarketCapUsd.toString(),

            // Shares (update if API provides)
            sharesOutstanding: sharesOutstanding.toString(),

            // Calculated metrics
            btcNavUsd: metrics.btcNav.toString(),
            enterpriseValueUsd: metrics.enterpriseValue.toString(),
            dilutedEvUsd: metrics.dilutedEv.toString(),
            basicMNav: metrics.basicMNav.toString(),
            dilutedMNav: metrics.dilutedMNav.toString(),
            priceAt1xDilutedMNav: metrics.priceAt1xDilutedMNav.toString(),

            // Metadata
            dataSource: q.provider,
            lastQuoteAt: new Date(),
            updatedAt: new Date()
          })
          .where(eq(companies.id, company.id))

        updated++
      } catch (error) {
        errors++
        const errMsg = `${company.ticker}: ${error instanceof Error ? error.message : "Unknown error"}`
        errorDetails.push(errMsg)
        console.error(`[sync-market-data] Error updating ${company.ticker}:`, error)
      }
    }

    console.log(`[sync-market-data] Completed: ${updated} updated (API), ${fallbackUsed} updated (fallback), ${skipped} skipped, ${errors} errors`)
    if (fallbackTickers.length > 0) {
      console.log(`[sync-market-data] Fallback used for: ${fallbackTickers.join(", ")}`)
    }

    return NextResponse.json({
      success: true,
      updated,
      fallbackUsed,
      skipped,
      errors,
      total: allCompanies.length,
      btcPrice,
      quotesReceived: quotes.size,
      timestamp: new Date().toISOString(),
      ...(fallbackTickers.length > 0 && { fallbackTickers }),
      ...(errorDetails.length > 0 && { errorDetails: errorDetails.slice(0, 10) })
    })

  } catch (error) {
    console.error("[sync-market-data] Fatal error:", error)
    return NextResponse.json(
      {
        error: "Failed to sync market data",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    )
  }
}
