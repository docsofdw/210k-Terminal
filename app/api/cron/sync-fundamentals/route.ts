/**
 * Sync Fundamentals Cron Job
 *
 * Fetches balance sheet data (cash, debt, shares) from Twelve Data
 * for companies that have stale or missing fundamental data.
 *
 * Schedule: Daily at 6 AM UTC
 * Endpoint: /api/cron/sync-fundamentals
 *
 * Note: This endpoint is rate-limited due to high API credit costs.
 * Balance sheet data costs 100 credits per symbol on Twelve Data.
 */

import { db } from "@/db"
import { companies } from "@/db/schema/companies"
import * as twelvedata from "@/lib/api/twelve-data"
import { recalculateCompanyMetrics } from "@/lib/services/calculation-service"
import { NextRequest, NextResponse } from "next/server"
import { and, eq, isNotNull, or, isNull, lt, ne } from "drizzle-orm"

export const dynamic = "force-dynamic"
export const maxDuration = 300 // 5 minutes for fundamental data (rate limited)

// How many days before fundamentals are considered stale
const STALE_DAYS = 7

// Max companies to process per run (to stay within rate limits)
const MAX_COMPANIES_PER_RUN = 20

// Delay between API calls (ms) - 8 seconds for balance sheet rate limit
const API_DELAY_MS = 8000

export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Check for feature flag
  if (process.env.USE_LEGACY_SHEETS_SYNC === "true") {
    return NextResponse.json({
      success: true,
      skipped: true,
      reason: "Legacy sheets sync enabled, fundamentals sync disabled"
    })
  }

  // Check if Twelve Data is configured
  if (!twelvedata.isTwelveDataConfigured()) {
    return NextResponse.json({
      success: false,
      error: "TWELVE_DATA_API_KEY not configured"
    }, { status: 500 })
  }

  try {
    // Calculate stale date threshold
    const staleDate = new Date()
    staleDate.setDate(staleDate.getDate() - STALE_DAYS)

    // Get companies that need fundamental updates:
    // 1. No fundamentals data yet (lastFundamentalsAt is null)
    // 2. Fundamentals older than STALE_DAYS
    // 3. Cash/debt source is not "manual" (allow manual overrides to persist)
    const companiesNeedingUpdate = await db
      .select({
        id: companies.id,
        ticker: companies.ticker,
        yahooTicker: companies.yahooTicker,
        exchange: companies.exchange,
        cashSource: companies.cashSource,
        debtSource: companies.debtSource,
        lastFundamentalsAt: companies.lastFundamentalsAt
      })
      .from(companies)
      .where(
        and(
          eq(companies.isTracked, true),
          isNotNull(companies.ticker),
          or(
            isNull(companies.lastFundamentalsAt),
            lt(companies.lastFundamentalsAt, staleDate)
          )
        )
      )
      .limit(MAX_COMPANIES_PER_RUN)

    if (companiesNeedingUpdate.length === 0) {
      return NextResponse.json({
        success: true,
        updated: 0,
        message: "No companies need fundamental updates"
      })
    }

    console.log(`[sync-fundamentals] Processing ${companiesNeedingUpdate.length} companies...`)

    let updated = 0
    let errors = 0
    let skipped = 0
    const errorDetails: string[] = []

    for (const company of companiesNeedingUpdate) {
      const ticker = company.yahooTicker || company.ticker!

      try {
        // Fetch balance sheet from Twelve Data
        const balanceSheet = await twelvedata.getBalanceSheet(ticker, "quarterly")

        if (!balanceSheet?.balanceSheet?.[0]) {
          console.log(`[sync-fundamentals] No balance sheet data for ${ticker}`)
          skipped++
          continue
        }

        const latest = balanceSheet.balanceSheet[0]

        // Build update object, respecting manual overrides
        const updateData: Record<string, unknown> = {
          lastFundamentalsAt: new Date(),
          updatedAt: new Date()
        }

        // Only update cash if not manually overridden
        if (company.cashSource !== "manual" && latest.cashAndCashEquivalents !== null) {
          updateData.cashUsd = latest.cashAndCashEquivalents.toString()
          updateData.cashSource = "api"
        }

        // Only update debt if not manually overridden
        if (company.debtSource !== "manual" && latest.totalDebt !== null) {
          updateData.debtUsd = latest.totalDebt.toString()
          updateData.debtSource = "api"
        }

        // Always update diluted shares from balance sheet
        if (latest.commonStockSharesOutstanding !== null) {
          updateData.dilutedShares = latest.commonStockSharesOutstanding.toString()
        }

        // Update database
        await db.update(companies)
          .set(updateData)
          .where(eq(companies.id, company.id))

        // Recalculate metrics with new fundamental data
        await recalculateCompanyMetrics(company.id)

        console.log(`[sync-fundamentals] Updated ${ticker}: cash=${latest.cashAndCashEquivalents}, debt=${latest.totalDebt}`)
        updated++

      } catch (error) {
        errors++
        const errMsg = `${ticker}: ${error instanceof Error ? error.message : "Unknown error"}`
        errorDetails.push(errMsg)
        console.error(`[sync-fundamentals] Error processing ${ticker}:`, error)
      }

      // Rate limit: wait between API calls
      if (companiesNeedingUpdate.indexOf(company) < companiesNeedingUpdate.length - 1) {
        await new Promise(resolve => setTimeout(resolve, API_DELAY_MS))
      }
    }

    console.log(`[sync-fundamentals] Completed: ${updated} updated, ${skipped} skipped, ${errors} errors`)

    return NextResponse.json({
      success: true,
      updated,
      skipped,
      errors,
      processed: companiesNeedingUpdate.length,
      timestamp: new Date().toISOString(),
      ...(errorDetails.length > 0 && { errorDetails: errorDetails.slice(0, 10) })
    })

  } catch (error) {
    console.error("[sync-fundamentals] Fatal error:", error)
    return NextResponse.json(
      {
        error: "Failed to sync fundamentals",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    )
  }
}
