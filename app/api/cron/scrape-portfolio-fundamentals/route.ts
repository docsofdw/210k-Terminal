/**
 * Portfolio Fundamentals Scraper Cron Job
 *
 * Schedule: Weekly on Monday 6am UTC (0 6 * * 1)
 * Runs all Tier 1 scrapers (SWC, LQWD, Capital B, Oranje, etc.)
 *
 * Updates companies table with:
 * - sharesOutstanding
 * - dilutedShares
 * - sharesSource
 * - sharesLastVerified
 */

import { db } from "@/db"
import { companies } from "@/db/schema/companies"
import { eq } from "drizzle-orm"
import { NextRequest, NextResponse } from "next/server"
import { runAllScrapers, formatSharesData } from "@/lib/scrapers"
import { sendToPrimaryChat } from "@/lib/notifications/telegram"

export const dynamic = "force-dynamic"
export const maxDuration = 120 // 2 minutes for all scrapers

export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization")
  const cronSecret = process.env.CRON_SECRET

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const startTime = Date.now()
  const results: Array<{
    ticker: string
    name: string
    success: boolean
    error?: string
    updated?: boolean
    data?: {
      sharesOutstanding: number
      dilutedShares: number
    }
  }> = []

  try {
    // Run all scrapers
    const scraperResults = await runAllScrapers()

    // Process each result
    for (const { ticker, name, result } of scraperResults) {
      if (!result.success || !result.data) {
        results.push({
          ticker,
          name,
          success: false,
          error: result.error || "No data returned"
        })
        continue
      }

      // Look up company in database
      const [company] = await db
        .select()
        .from(companies)
        .where(eq(companies.ticker, ticker))
        .limit(1)

      if (!company) {
        results.push({
          ticker,
          name,
          success: false,
          error: `Company not found in database: ${ticker}`
        })
        continue
      }

      // Check if data changed
      const sharesChanged =
        Number(company.sharesOutstanding) !== result.data.sharesOutstanding
      const dilutedChanged =
        Number(company.dilutedShares) !== result.data.dilutedShares

      if (!sharesChanged && !dilutedChanged) {
        results.push({
          ticker,
          name,
          success: true,
          updated: false,
          data: {
            sharesOutstanding: result.data.sharesOutstanding,
            dilutedShares: result.data.dilutedShares
          }
        })
        continue
      }

      // Update database
      await db
        .update(companies)
        .set({
          sharesOutstanding: result.data.sharesOutstanding.toString(),
          dilutedShares: result.data.dilutedShares.toString(),
          sharesSource: `scraper:${ticker.toLowerCase().split(".")[0]}`,
          sharesLastVerified: new Date(),
          dilutionSource: `scraper:${ticker.toLowerCase().split(".")[0]}`,
          dilutionLastVerified: new Date(),
          capitalStructureNotes: result.data.notes || null,
          updatedAt: new Date()
        })
        .where(eq(companies.id, company.id))

      results.push({
        ticker,
        name,
        success: true,
        updated: true,
        data: {
          sharesOutstanding: result.data.sharesOutstanding,
          dilutedShares: result.data.dilutedShares
        }
      })
    }

    // Build summary
    const successful = results.filter((r) => r.success)
    const failed = results.filter((r) => !r.success)
    const updated = results.filter((r) => r.updated)

    const duration = Date.now() - startTime

    // Send Telegram notification if any changes or failures
    if (updated.length > 0 || failed.length > 0) {
      const lines = ["<b>Portfolio Fundamentals Scraper</b>", ""]

      if (updated.length > 0) {
        lines.push(`<b>Updated (${updated.length}):</b>`)
        for (const r of updated) {
          lines.push(
            `- ${r.name}: ${r.data?.sharesOutstanding.toLocaleString()} / ${r.data?.dilutedShares.toLocaleString()}`
          )
        }
        lines.push("")
      }

      if (failed.length > 0) {
        lines.push(`<b>Failed (${failed.length}):</b>`)
        for (const r of failed) {
          lines.push(`- ${r.name}: ${r.error}`)
        }
      }

      lines.push("", `<i>Completed in ${duration}ms</i>`)

      await sendToPrimaryChat(lines.join("\n"))
    }

    return NextResponse.json({
      success: true,
      summary: {
        total: results.length,
        successful: successful.length,
        failed: failed.length,
        updated: updated.length,
        durationMs: duration
      },
      results
    })
  } catch (error) {
    console.error("Scraper cron error:", error)

    // Send failure notification
    await sendToPrimaryChat(
      `<b>Portfolio Scraper Failed</b>\n\nError: ${error instanceof Error ? error.message : "Unknown error"}`
    )

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    )
  }
}
