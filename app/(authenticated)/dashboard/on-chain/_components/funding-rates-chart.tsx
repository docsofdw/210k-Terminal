"use client"

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine
} from "recharts"
import type { OnChainMetricDataPoint } from "@/lib/api/bitcoin-magazine-pro"

interface FundingRatesChartProps {
  data: OnChainMetricDataPoint[]
}

export function FundingRatesChart({ data }: FundingRatesChartProps) {
  const chartData = data.map(point => {
    // API returns funding_rate_usd (already a decimal like 0.00007)
    const fundingRate = (point["funding_rate_usd"] as number) ?? 0

    return {
      date: new Date(point.date).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric"
      }),
      fullDate: point.date,
      fundingRate: fundingRate * 100 // Convert to percentage (e.g., 0.007%)
    }
  })

  if (chartData.length === 0) {
    return (
      <div className="flex h-[300px] items-center justify-center text-muted-foreground">
        <p>No funding rates data available.</p>
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <AreaChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
        <defs>
          <linearGradient id="fundingGradientPositive" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#00d26a" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#00d26a" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="fundingGradientNegative" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
          </linearGradient>
        </defs>
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
          tickFormatter={(value) => `${value.toFixed(2)}%`}
          domain={["auto", "auto"]}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: "#1a1a1a",
            border: "1px solid #333",
            borderRadius: "4px"
          }}
          labelStyle={{ color: "#999" }}
          formatter={(value) => [
            `${Number(value).toFixed(4)}%`,
            "Funding Rate"
          ]}
        />
        <ReferenceLine y={0} stroke="#666" strokeDasharray="3 3" />
        <Area
          type="monotone"
          dataKey="fundingRate"
          name="Funding Rate"
          stroke="#ff8200"
          strokeWidth={2}
          fill="url(#fundingGradientPositive)"
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}
