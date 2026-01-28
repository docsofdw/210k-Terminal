"use client"

import { useState } from "react"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from "recharts"
import { Button } from "@/components/ui/button"
import { DollarSign, Coins } from "lucide-react"
import type { SelectDailySnapshot } from "@/db/schema/daily-snapshots"

// Currency symbols for display
const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: "$",
  CAD: "C$",
  EUR: "€",
  GBP: "£",
  JPY: "¥",
  HKD: "HK$",
  AUD: "A$",
  BRL: "R$",
  THB: "฿",
  KRW: "₩"
}

interface CompanyPriceChartProps {
  data: SelectDailySnapshot[]
  companyName: string
  currency: string
}

export function CompanyPriceChart({ data, companyName, currency }: CompanyPriceChartProps) {
  const [showUsd, setShowUsd] = useState(false)

  const chartData = data.map(snapshot => ({
    date: new Date(snapshot.snapshotDate).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric"
    }),
    fullDate: new Date(snapshot.snapshotDate).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric"
    }),
    stockPrice: snapshot.stockPrice ? parseFloat(snapshot.stockPrice) : null,
    stockPriceUsd: snapshot.stockPriceUsd ? parseFloat(snapshot.stockPriceUsd) : null
  }))

  if (chartData.length === 0) {
    return (
      <div className="flex h-[300px] items-center justify-center text-muted-foreground">
        <p>No price history available for {companyName}.</p>
      </div>
    )
  }

  // Check if we have both local and USD prices
  const hasLocalPrice = chartData.some(d => d.stockPrice !== null)
  const hasUsdPrice = chartData.some(d => d.stockPriceUsd !== null)
  const canToggle = hasLocalPrice && hasUsdPrice && currency !== "USD"

  // Determine which price to show
  const priceKey = showUsd || !hasLocalPrice ? "stockPriceUsd" : "stockPrice"
  const displayCurrency = priceKey === "stockPriceUsd" ? "USD" : currency
  const currencySymbol = CURRENCY_SYMBOLS[displayCurrency] || ""

  // Format price based on currency (some currencies need no decimals)
  const formatPrice = (value: number): string => {
    if (displayCurrency === "JPY" || displayCurrency === "KRW") {
      return `${currencySymbol}${Math.round(value).toLocaleString()}`
    }
    return `${currencySymbol}${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }

  return (
    <div className="space-y-3">
      {/* Currency Toggle */}
      {canToggle && (
        <div className="flex items-center justify-end gap-2">
          <span className="text-xs text-muted-foreground">Currency:</span>
          <div className="flex rounded-md border border-border/50 bg-background">
            <Button
              variant="ghost"
              size="sm"
              className={`h-7 rounded-r-none px-3 text-xs ${!showUsd ? "bg-muted" : ""}`}
              onClick={() => setShowUsd(false)}
            >
              <Coins className="mr-1 h-3 w-3" />
              {currency}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className={`h-7 rounded-l-none border-l border-border/50 px-3 text-xs ${showUsd ? "bg-muted" : ""}`}
              onClick={() => setShowUsd(true)}
            >
              <DollarSign className="mr-1 h-3 w-3" />
              USD
            </Button>
          </div>
        </div>
      )}

      {/* Chart */}
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#333" />
          <XAxis
            dataKey="date"
            stroke="#666"
            fontSize={12}
            tickLine={false}
          />
          <YAxis
            stroke="#666"
            fontSize={12}
            tickLine={false}
            tickFormatter={(value) => formatPrice(value)}
            domain={["auto", "auto"]}
            width={80}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "#1a1a1a",
              border: "1px solid #333",
              borderRadius: "4px"
            }}
            labelStyle={{ color: "#999" }}
            labelFormatter={(_, payload) => {
              if (payload && payload[0]) {
                return payload[0].payload.fullDate
              }
              return ""
            }}
            formatter={(value) => [
              formatPrice(Number(value)),
              `Price (${displayCurrency})`
            ]}
          />
          <Line
            type="monotone"
            dataKey={priceKey}
            name="Stock Price"
            stroke="#3b82f6"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
            connectNulls
          />
        </LineChart>
      </ResponsiveContainer>

      {/* Currency note */}
      <p className="text-center text-[10px] text-muted-foreground">
        Showing prices in {displayCurrency}
        {showUsd && currency !== "USD" && ` (converted from ${currency})`}
      </p>
    </div>
  )
}
