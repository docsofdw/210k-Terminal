"use client"

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from "recharts"
import type { OnChainMetricDataPoint } from "@/lib/api/bitcoin-magazine-pro"

interface VolatilityChartProps {
  data: OnChainMetricDataPoint[]
}

export function VolatilityChart({ data }: VolatilityChartProps) {
  const chartData = data.map(point => {
    // API returns multiple volatility timeframes, use 1-month as primary
    const volatility = (point["bitcoin_volatility_1m"] as number) ?? 0

    return {
      date: new Date(point.date).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric"
      }),
      fullDate: point.date,
      volatility: volatility * 100 // Convert to percentage
    }
  })

  if (chartData.length === 0) {
    return (
      <div className="flex h-[300px] items-center justify-center text-muted-foreground">
        <p>No volatility data available.</p>
      </div>
    )
  }

  // Get latest and average values
  const latestVolatility = chartData[chartData.length - 1]?.volatility ?? 0
  const avgVolatility =
    chartData.reduce((sum, d) => sum + d.volatility, 0) / chartData.length

  return (
    <div>
      {/* Stats */}
      <div className="mb-4 flex gap-6">
        <div>
          <div className="text-2xl font-bold text-terminal-orange">
            {latestVolatility.toFixed(1)}%
          </div>
          <div className="text-xs text-muted-foreground">Current</div>
        </div>
        <div>
          <div className="text-2xl font-bold">
            {avgVolatility.toFixed(1)}%
          </div>
          <div className="text-xs text-muted-foreground">Period Average</div>
        </div>
      </div>

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
            tickFormatter={(value) => `${value.toFixed(0)}%`}
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
              `${Number(value).toFixed(2)}%`,
              "Volatility"
            ]}
          />
          <Line
            type="monotone"
            dataKey="volatility"
            name="Volatility"
            stroke="#ff8200"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, fill: "#ff8200" }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
