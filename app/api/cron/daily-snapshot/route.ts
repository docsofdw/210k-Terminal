import { db } from "@/db"
import { companies } from "@/db/schema/companies"
import { dailySnapshots, marketSnapshots } from "@/db/schema/daily-snapshots"
import { btcPrices } from "@/db/schema/btc-prices"
import { stockPrices } from "@/db/schema/stock-prices"
import { fxRates } from "@/db/schema/fx-rates"
import { getCompsTableData } from "@/lib/api/google-sheets"
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
    const [
      allCompanies,
      latestBtcPrice,
      allStockPrices,
      allFxRates
    ] = await Promise.all([
      db.select().from(companies).where(eq(companies.status, "active")),
      db.query.btcPrices.findFirst({ orderBy: [desc(btcPrices.priceAt)] }),
      db.select().from(stockPrices).orderBy(desc(stockPrices.priceAt)),
      db.select().from(fxRates).orderBy(desc(fxRates.rateAt))
    ])

    // Get BTC price
    let btcPrice = latestBtcPrice ? parseFloat(latestBtcPrice.priceUsd) : null

    // Build stock price map (latest price per company)
    const stockPriceMap = new Map<string, number>()
    const seenCompanyIds = new Set<string>()
    for (const price of allStockPrices) {
      if (!seenCompanyIds.has(price.companyId)) {
        stockPriceMap.set(price.companyId, parseFloat(price.price))
        seenCompanyIds.add(price.companyId)
      }
    }

    // Build FX rate map
    const fxRateMap = new Map<string, number>()
    const seenCurrencies = new Set<string>()
    for (const rate of allFxRates) {
      if (!seenCurrencies.has(rate.currency)) {
        fxRateMap.set(rate.currency, parseFloat(rate.rateToUsd))
        seenCurrencies.add(rate.currency)
      }
    }

    // Try Google Sheets as backup if we're missing data
    let sheetData: Map<string, { btcHoldings?: number; mNav?: number }> | null = null
    if (!btcPrice || stockPriceMap.size === 0) {
      const sheetsResult = await getCompsTableData()
      if (sheetsResult) {
        if (!btcPrice && sheetsResult.btcPrice) {
          btcPrice = sheetsResult.btcPrice
        }
        sheetData = new Map()
        for (const company of sheetsResult.companies) {
          sheetData.set(company.ticker.toUpperCase(), {
            btcHoldings: company.btcHoldings ?? undefined,
            mNav: company.mNav ?? undefined
          })
        }
      }
    }

    if (!btcPrice) {
      return NextResponse.json(
        { error: "No BTC price available from any source" },
        { status: 500 }
      )
    }

    // Create snapshots for each company
    const snapshots: typeof dailySnapshots.$inferInsert[] = []
    let totalBtcHoldings = 0
    let totalMarketCapUsd = 0
    let totalEvUsd = 0
    let totalBtcNav = 0
    const mNavValues: number[] = []

    for (const company of allCompanies) {
      const stockPrice = stockPriceMap.get(company.id)
      const fxRate = fxRateMap.get(company.tradingCurrency) || 1
      const sheetCompany = sheetData?.get(company.ticker.toUpperCase())

      // Calculate values
      const stockPriceUsd = stockPrice ? stockPrice / fxRate : null
      const btcHoldings = company.btcHoldings
        ? parseFloat(company.btcHoldings)
        : sheetCompany?.btcHoldings ?? null
      const sharesOutstanding = company.sharesOutstanding
        ? parseFloat(company.sharesOutstanding)
        : null
      const cashUsd = company.cashUsd ? parseFloat(company.cashUsd) : 0
      const debtUsd = company.debtUsd ? parseFloat(company.debtUsd) : 0
      const preferredsUsd = company.preferredsUsd
        ? parseFloat(company.preferredsUsd)
        : 0

      // Market cap
      const marketCapUsd =
        stockPriceUsd && sharesOutstanding
          ? stockPriceUsd * sharesOutstanding
          : null

      // BTC NAV
      const btcNav = btcHoldings ? btcHoldings * btcPrice : null

      // Enterprise Value
      const evUsd = marketCapUsd
        ? marketCapUsd + debtUsd + preferredsUsd - cashUsd
        : null

      // mNAV
      let mNav: number | null = null
      if (evUsd && btcNav && btcNav > 0) {
        mNav = evUsd / btcNav
      } else if (sheetCompany?.mNav) {
        mNav = sheetCompany.mNav
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
        tradingCurrency: company.tradingCurrency,
        dataSource: sheetData ? "google_sheets" : "database",
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
      dataSource: sheetData ? "mixed" : "database"
    })
  } catch (error) {
    console.error("Daily snapshot cron error:", error)
    return NextResponse.json(
      { error: "Failed to create daily snapshot" },
      { status: 500 }
    )
  }
}
