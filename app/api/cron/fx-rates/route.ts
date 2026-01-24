import { db } from "@/db"
import { fxRates } from "@/db/schema/fx-rates"
import { getFxRates, SUPPORTED_CURRENCIES } from "@/lib/api/fx-rates"
import { NextRequest, NextResponse } from "next/server"

export const dynamic = "force-dynamic"
export const maxDuration = 30

export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    // Get FX rates from API
    const ratesData = await getFxRates("USD")

    if (!ratesData) {
      return NextResponse.json(
        { error: "Failed to fetch FX rates" },
        { status: 500 }
      )
    }

    // Insert rate records for each currency pair
    const insertPromises = SUPPORTED_CURRENCIES.filter(
      currency => currency !== "USD"
    ).map(currency => {
      const rateToUsd = ratesData.rates[currency]
      if (!rateToUsd) return null

      // Rate from USD is the inverse
      const rateFromUsd = 1 / rateToUsd

      return db.insert(fxRates).values({
        currency,
        rateToUsd: rateToUsd.toString(),
        rateFromUsd: rateFromUsd.toString(),
        rateAt: ratesData.timestamp
      })
    })

    await Promise.all(insertPromises.filter(Boolean))

    return NextResponse.json({
      success: true,
      rates: ratesData.rates,
      timestamp: ratesData.timestamp.toISOString()
    })
  } catch (error) {
    console.error("FX rates cron error:", error)
    return NextResponse.json(
      { error: "Failed to update FX rates" },
      { status: 500 }
    )
  }
}
