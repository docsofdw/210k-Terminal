import { db } from "@/db"
import { btcPrices } from "@/db/schema/btc-prices"
import { getBtcPriceDetailed } from "@/lib/api/coingecko"
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
    // Get BTC price from CoinGecko
    const btcData = await getBtcPriceDetailed()

    if (!btcData) {
      return NextResponse.json(
        { error: "Failed to fetch BTC price" },
        { status: 500 }
      )
    }

    // Insert price record
    await db.insert(btcPrices).values({
      priceUsd: btcData.priceUsd.toString(),
      high24h: btcData.high24h?.toString() ?? null,
      low24h: btcData.low24h?.toString() ?? null,
      volume24h: btcData.volume24h?.toString() ?? null,
      change24h: btcData.change24h?.toString() ?? null,
      marketCap: btcData.marketCap?.toString() ?? null,
      priceAt: btcData.timestamp
    })

    return NextResponse.json({
      success: true,
      price: btcData.priceUsd,
      change24h: btcData.change24h,
      timestamp: btcData.timestamp.toISOString()
    })
  } catch (error) {
    console.error("BTC price cron error:", error)
    return NextResponse.json(
      { error: "Failed to update BTC price" },
      { status: 500 }
    )
  }
}
