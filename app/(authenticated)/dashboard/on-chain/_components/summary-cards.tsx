"use client"

import { TrendingUp, TrendingDown, Minus } from "lucide-react"
import type { OnChainMetricDataPoint } from "@/lib/api/bitcoin-magazine-pro"

interface SummaryCardsProps {
  fearGreedData: OnChainMetricDataPoint[]
  fundingRatesData: OnChainMetricDataPoint[]
  heatmap200WMAData: OnChainMetricDataPoint[]
  mvrvData: OnChainMetricDataPoint[]
}

function getSentimentColor(value: number): string {
  if (value <= 20) return "#ef4444"
  if (value <= 40) return "#f97316"
  if (value <= 60) return "#eab308"
  if (value <= 80) return "#84cc16"
  return "#00d26a"
}

function getSentimentLabel(value: number): string {
  if (value <= 20) return "Extreme Fear"
  if (value <= 40) return "Fear"
  if (value <= 60) return "Neutral"
  if (value <= 80) return "Greed"
  return "Extreme Greed"
}

function getMvrvZone(value: number): { label: string; color: string } {
  if (value >= 7) return { label: "Overvalued", color: "#ef4444" }
  if (value >= 5) return { label: "High", color: "#f97316" }
  if (value >= 3) return { label: "Fair+", color: "#eab308" }
  if (value >= 0) return { label: "Fair", color: "#84cc16" }
  return { label: "Undervalued", color: "#00d26a" }
}

function getFundingTrend(data: OnChainMetricDataPoint[]): { trend: "bullish" | "bearish" | "neutral"; avg: number } {
  if (data.length < 7) return { trend: "neutral", avg: 0 }

  const recent = data.slice(-7)
  const avg = recent.reduce((sum, d) => sum + ((d["funding_rate_usd"] as number) ?? 0), 0) / recent.length

  if (avg > 0.00005) return { trend: "bullish", avg: avg * 100 }
  if (avg < -0.00002) return { trend: "bearish", avg: avg * 100 }
  return { trend: "neutral", avg: avg * 100 }
}

export function SummaryCards({ fearGreedData, fundingRatesData, heatmap200WMAData, mvrvData }: SummaryCardsProps) {
  // Extract latest values
  const latestFearGreed = fearGreedData.length > 0
    ? (fearGreedData[fearGreedData.length - 1]["value"] as number) ?? 50
    : 50

  const latestPrice = heatmap200WMAData.length > 0
    ? (heatmap200WMAData[heatmap200WMAData.length - 1]["Price"] as number) ?? 0
    : 0

  const latest200WMA = heatmap200WMAData.length > 0
    ? (heatmap200WMAData[heatmap200WMAData.length - 1]["200week_avg"] as number) ?? 0
    : 0

  const premiumTo200WMA = latest200WMA > 0
    ? ((latestPrice - latest200WMA) / latest200WMA) * 100
    : 0

  const latestMvrv = mvrvData.length > 0
    ? (mvrvData[mvrvData.length - 1]["ZScore"] as number) ?? 0
    : 0

  const fundingTrend = getFundingTrend(fundingRatesData)
  const mvrvZone = getMvrvZone(latestMvrv)

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {/* Fear & Greed */}
      <div className="rounded-lg border border-border/50 bg-card p-4">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">
          Fear & Greed
        </div>
        <div className="flex items-center gap-3">
          <div
            className="flex h-12 w-12 items-center justify-center rounded-full text-lg font-bold"
            style={{
              backgroundColor: getSentimentColor(latestFearGreed) + "20",
              color: getSentimentColor(latestFearGreed)
            }}
          >
            {latestFearGreed}
          </div>
          <div className="text-xs font-medium" style={{ color: getSentimentColor(latestFearGreed) }}>
            {getSentimentLabel(latestFearGreed)}
          </div>
        </div>
      </div>

      {/* MVRV Z-Score */}
      <div className="rounded-lg border border-border/50 bg-card p-4">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">
          MVRV Z-Score
        </div>
        <div className="flex items-center gap-3">
          <div
            className="flex h-12 w-12 items-center justify-center rounded-full text-lg font-bold"
            style={{
              backgroundColor: mvrvZone.color + "20",
              color: mvrvZone.color
            }}
          >
            {latestMvrv.toFixed(1)}
          </div>
          <div className="text-xs font-medium" style={{ color: mvrvZone.color }}>
            {mvrvZone.label}
          </div>
        </div>
      </div>

      {/* Premium to 200 WMA */}
      <div className="rounded-lg border border-border/50 bg-card p-4">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">
          Premium to 200 WMA
        </div>
        <div className="flex items-center gap-2">
          <div className={`text-2xl font-bold ${premiumTo200WMA >= 0 ? "text-green-500" : "text-red-500"}`}>
            {premiumTo200WMA >= 0 ? "+" : ""}{premiumTo200WMA.toFixed(0)}%
          </div>
          {premiumTo200WMA >= 50 ? (
            <TrendingUp className="h-5 w-5 text-yellow-500" />
          ) : premiumTo200WMA >= 0 ? (
            <TrendingUp className="h-5 w-5 text-green-500" />
          ) : (
            <TrendingDown className="h-5 w-5 text-red-500" />
          )}
        </div>
        <div className="text-xs text-muted-foreground mt-1">
          ${latestPrice.toLocaleString(undefined, { maximumFractionDigits: 0 })} vs ${latest200WMA.toLocaleString(undefined, { maximumFractionDigits: 0 })}
        </div>
      </div>

      {/* Funding Rate Trend */}
      <div className="rounded-lg border border-border/50 bg-card p-4">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">
          Funding (7D Avg)
        </div>
        <div className="flex items-center gap-2">
          <div className={`text-2xl font-bold ${
            fundingTrend.trend === "bullish" ? "text-green-500" :
            fundingTrend.trend === "bearish" ? "text-red-500" :
            "text-muted-foreground"
          }`}>
            {fundingTrend.avg >= 0 ? "+" : ""}{fundingTrend.avg.toFixed(4)}%
          </div>
          {fundingTrend.trend === "bullish" ? (
            <TrendingUp className="h-5 w-5 text-green-500" />
          ) : fundingTrend.trend === "bearish" ? (
            <TrendingDown className="h-5 w-5 text-red-500" />
          ) : (
            <Minus className="h-5 w-5 text-muted-foreground" />
          )}
        </div>
        <div className="text-xs text-muted-foreground mt-1 capitalize">
          {fundingTrend.trend} bias
        </div>
      </div>
    </div>
  )
}
