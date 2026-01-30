import { db } from "@/db"
import { companies } from "@/db/schema/companies"
import { dailySnapshots, marketSnapshots } from "@/db/schema/daily-snapshots"
import { btcPrices } from "@/db/schema/btc-prices"
import { fxRates } from "@/db/schema/fx-rates"
import { desc, eq } from "drizzle-orm"
import { NextRequest, NextResponse } from "next/server"

export const dynamic = "force-dynamic"
export const maxDuration = 60

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
    const snapshotDate = normalizeDate(new Date())

    // Fetch all required data
    // NOTE: Now reads prices directly from companies table (updated by sync-market-data cron)
    // instead of the separate stock_prices table
    const [
      allCompanies,
      latestBtcPrice,
      allFxRates
    ] = await Promise.all([
      db.select().from(companies).where(eq(companies.status, "active")),
      db.query.btcPrices.findFirst({ orderBy: [desc(btcPrices.priceAt)] }),
      db.select().from(fxRates).orderBy(desc(fxRates.rateAt))
    ])

    // Get BTC price
    const btcPrice = latestBtcPrice ? parseFloat(latestBtcPrice.priceUsd) : null

    // Build FX rate map
    const fxRateMap = new Map<string, number>()
    const seenCurrencies = new Set<string>()
    for (const rate of allFxRates) {
      if (!seenCurrencies.has(rate.currency)) {
        fxRateMap.set(rate.currency, parseFloat(rate.rateToUsd))
        seenCurrencies.add(rate.currency)
      }
    }

    if (!btcPrice) {
      return NextResponse.json(
        { error: "No BTC price available" },
        { status: 500 }
      )
    }

    // Create snapshots for each company
    // Now uses pre-calculated values from companies table (updated by sync-market-data cron)
    const snapshots: typeof dailySnapshots.$inferInsert[] = []
    let totalBtcHoldings = 0
    let totalMarketCapUsd = 0
    let totalEvUsd = 0
    let totalBtcNav = 0
    const mNavValues: number[] = []

    for (const company of allCompanies) {
      // Read stock price directly from companies table (set by sync-market-data)
      const stockPrice = company.price ? parseFloat(company.price) : null
      const currencyCode = company.tradingCurrency || company.currencyCode || "USD"
      const fxRate = company.conversionRate
        ? parseFloat(company.conversionRate)
        : fxRateMap.get(currencyCode) || 1

      // Use values from companies table (already updated by sync-market-data)
      const stockPriceUsd = stockPrice ? stockPrice / fxRate : null
      const btcHoldings = company.btcHoldings ? parseFloat(company.btcHoldings) : null
      const sharesOutstanding = company.sharesOutstanding
        ? parseFloat(company.sharesOutstanding)
        : null
      const cashUsd = company.cashUsd ? parseFloat(company.cashUsd) : 0
      const debtUsd = company.debtUsd ? parseFloat(company.debtUsd) : 0
      const preferredsUsd = company.preferredsUsd
        ? parseFloat(company.preferredsUsd)
        : 0

      // Use DILUTED market cap from companies table (matches Comps table D.MNAV)
      // Fall back to basic market cap if diluted not available
      const dilutedShares = company.dilutedShares
        ? parseFloat(company.dilutedShares)
        : sharesOutstanding
      const marketCapUsd = company.dilutedMarketCapUsd
        ? parseFloat(company.dilutedMarketCapUsd)
        : company.marketCapUsd
          ? parseFloat(company.marketCapUsd)
          : stockPriceUsd && dilutedShares
            ? stockPriceUsd * dilutedShares
            : null

      // Use pre-calculated BTC NAV from companies table, or calculate if missing
      const btcNav = company.btcNavUsd
        ? parseFloat(company.btcNavUsd)
        : btcHoldings
          ? btcHoldings * btcPrice
          : null

      // Use DILUTED EV from companies table (matches Comps table)
      // EV = Diluted Market Cap + Debt + Preferreds - Cash
      const evUsd = company.dilutedEvUsd
        ? parseFloat(company.dilutedEvUsd)
        : company.enterpriseValueUsd
          ? parseFloat(company.enterpriseValueUsd)
          : marketCapUsd
            ? marketCapUsd + debtUsd + preferredsUsd - cashUsd
            : null

      // Use DILUTED mNAV from companies table (this is what Comps table shows as D.MNAV)
      // This accounts for warrants, options, convertibles, etc.
      let mNav: number | null = company.dilutedMNav
        ? parseFloat(company.dilutedMNav)
        : null
      if (!mNav && evUsd && btcNav && btcNav > 0) {
        mNav = evUsd / btcNav
      }

      // Sats per share
      const satsPerShare =
        btcHoldings && sharesOutstanding
          ? (btcHoldings * 100_000_000) / sharesOutstanding
          : null

      // BTC per share
      const btcPerShare =
        btcHoldings && sharesOutstanding
          ? btcHoldings / sharesOutstanding
          : null

      // Accumulate totals
      if (btcHoldings) totalBtcHoldings += btcHoldings
      if (marketCapUsd) totalMarketCapUsd += marketCapUsd
      if (evUsd) totalEvUsd += evUsd
      if (btcNav) totalBtcNav += btcNav
      if (mNav) mNavValues.push(mNav)

      snapshots.push({
        snapshotDate,
        companyId: company.id,
        ticker: company.ticker,
        companyName: company.name,
        stockPrice: stockPrice?.toString() ?? null,
        stockPriceUsd: stockPriceUsd?.toString() ?? null,
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
        tradingCurrency: currencyCode,
        dataSource: company.dataSource || "database",
        rawData: { company, stockPrice, fxRate }
      })
    }

    // Calculate aggregate metrics
    const avgMNav =
      mNavValues.length > 0
        ? mNavValues.reduce((a, b) => a + b, 0) / mNavValues.length
        : null

    const sortedMNav = [...mNavValues].sort((a, b) => a - b)
    const medianMNav =
      sortedMNav.length > 0
        ? sortedMNav.length % 2 === 0
          ? (sortedMNav[sortedMNav.length / 2 - 1] +
              sortedMNav[sortedMNav.length / 2]) /
            2
          : sortedMNav[Math.floor(sortedMNav.length / 2)]
        : null

    // Weighted average mNAV (by market cap)
    let weightedAvgMNav: number | null = null
    if (totalMarketCapUsd > 0) {
      let weightedSum = 0
      for (const snapshot of snapshots) {
        const mNav = snapshot.mNav ? parseFloat(snapshot.mNav) : null
        const marketCap = snapshot.marketCapUsd
          ? parseFloat(snapshot.marketCapUsd)
          : null
        if (mNav && marketCap) {
          weightedSum += mNav * marketCap
        }
      }
      weightedAvgMNav = weightedSum / totalMarketCapUsd
    }

    // Insert all snapshots
    if (snapshots.length > 0) {
      await db.insert(dailySnapshots).values(snapshots)
    }

    // Insert market snapshot
    await db.insert(marketSnapshots).values({
      snapshotDate,
      btcPrice: btcPrice.toString(),
      totalBtcHoldings: totalBtcHoldings.toString(),
      totalMarketCapUsd: totalMarketCapUsd.toString(),
      totalEvUsd: totalEvUsd.toString(),
      totalBtcNav: totalBtcNav.toString(),
      avgMNav: avgMNav?.toString() ?? null,
      medianMNav: medianMNav?.toString() ?? null,
      weightedAvgMNav: weightedAvgMNav?.toString() ?? null,
      companyCount: allCompanies.length.toString()
    })

    return NextResponse.json({
      success: true,
      snapshotDate: snapshotDate.toISOString(),
      companiesSnapshot: snapshots.length,
      btcPrice,
      totalBtcHoldings,
      avgMNav,
      dataSource: "api_calculated"
    })
  } catch (error) {
    console.error("Daily snapshot cron error:", error)
    return NextResponse.json(
      { error: "Failed to create daily snapshot" },
      { status: 500 }
    )
  }
}
