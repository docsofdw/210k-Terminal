import { NextRequest, NextResponse } from "next/server"
import { analyzeStrategy } from "@/lib/services/strategy-analyzer"
import type { StrategyAnalysisRequest } from "@/types/derivatives"

export const dynamic = "force-dynamic"
export const maxDuration = 30

/**
 * POST /api/options/analyze
 *
 * Analyze an options strategy and return risk metrics
 *
 * Request body:
 * {
 *   legs: [
 *     {
 *       strike: 55,
 *       type: "call",
 *       action: "buy",
 *       quantity: 1,
 *       premium: 2.50,
 *       iv: 0.45,
 *       delta: 0.5,
 *       gamma: 0.05,
 *       theta: -0.02,
 *       vega: 0.1
 *     }
 *   ],
 *   underlyingPrice: 52.00,
 *   btcPrice: 95000,
 *   riskFreeRate: 0.05,
 *   daysToExpiry: 30,
 *   targetPrices: [45, 50, 55, 60, 65]
 * }
 *
 * Response:
 * {
 *   totalCost: 250,
 *   totalCostBtc: 0.00263,
 *   maxProfit: "unlimited" | number,
 *   maxProfitPrice: null | number,
 *   maxLoss: number,
 *   maxLossPrice: number,
 *   breakevens: [{ price: 57.50, btcPrice: 104807 }],
 *   currentPnl: -50,
 *   currentPnlPercent: -20,
 *   currentPnlBtc: -0.00053,
 *   targetPnls: [...],
 *   daysToExpiry: 30,
 *   theta: -0.02,
 *   totalDelta: 0.5,
 *   totalGamma: 0.05,
 *   totalVega: 0.1
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body: StrategyAnalysisRequest = await request.json()

    // Validate required fields
    if (!body.legs || !Array.isArray(body.legs) || body.legs.length === 0) {
      return NextResponse.json(
        { error: "At least one leg is required" },
        { status: 400 }
      )
    }

    if (typeof body.underlyingPrice !== "number" || body.underlyingPrice <= 0) {
      return NextResponse.json(
        { error: "Valid underlyingPrice is required" },
        { status: 400 }
      )
    }

    if (typeof body.daysToExpiry !== "number" || body.daysToExpiry < 0) {
      return NextResponse.json(
        { error: "Valid daysToExpiry is required" },
        { status: 400 }
      )
    }

    // Validate each leg
    for (const leg of body.legs) {
      if (typeof leg.strike !== "number" || leg.strike <= 0) {
        return NextResponse.json(
          { error: "Each leg must have a valid strike price" },
          { status: 400 }
        )
      }
      if (!["call", "put"].includes(leg.type)) {
        return NextResponse.json(
          { error: "Each leg type must be 'call' or 'put'" },
          { status: 400 }
        )
      }
      if (!["buy", "sell"].includes(leg.action)) {
        return NextResponse.json(
          { error: "Each leg action must be 'buy' or 'sell'" },
          { status: 400 }
        )
      }
      if (typeof leg.quantity !== "number" || leg.quantity <= 0) {
        return NextResponse.json(
          { error: "Each leg must have a positive quantity" },
          { status: 400 }
        )
      }
      if (typeof leg.premium !== "number" || leg.premium < 0) {
        return NextResponse.json(
          { error: "Each leg must have a valid premium" },
          { status: 400 }
        )
      }
    }

    // Convert legs to SimpleLeg format for analyzer
    const simpleLegs = body.legs.map((leg) => ({
      strike: leg.strike,
      type: leg.type,
      action: leg.action,
      quantity: leg.quantity,
      premium: leg.premium,
      iv: leg.iv
    }))

    const analysis = analyzeStrategy({
      legs: simpleLegs,
      underlyingPrice: body.underlyingPrice,
      btcPrice: body.btcPrice || null,
      daysToExpiry: body.daysToExpiry,
      targetPrices: body.targetPrices || []
    })

    return NextResponse.json(analysis)
  } catch (error) {
    console.error("Strategy analysis API error:", error)
    return NextResponse.json(
      { error: "Failed to analyze strategy" },
      { status: 500 }
    )
  }
}
