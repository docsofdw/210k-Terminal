"use client"

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  ReferenceArea
} from "recharts"
import type { OnChainMetricDataPoint } from "@/lib/api/bitcoin-magazine-pro"

interface FearGreedChartProps {
  data: OnChainMetricDataPoint[]
}

function getSentimentLabel(value: number): string {
  if (value <= 20) return "Extreme Fear"
  if (value <= 40) return "Fear"
  if (value <= 60) return "Neutral"
  if (value <= 80) return "Greed"
  return "Extreme Greed"
}

function getSentimentColor(value: number): string {
  if (value <= 20) return "#ef4444" // Red
  if (value <= 40) return "#f97316" // Orange
  if (value <= 60) return "#eab308" // Yellow
  if (value <= 80) return "#84cc16" // Lime
  return "#00d26a" // Green
}

export function FearGreedChart({ data }: FearGreedChartProps) {
  const chartData = data.map(point => {
    // API returns "value" (0-100)
    const value = (point["value"] as number) ?? 0

    return {
      date: new Date(point.date).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric"
      }),
      fullDate: point.date,
      value,
      sentiment: getSentimentLabel(value)
    }
  })

  if (chartData.length === 0) {
    return (
      <div className="flex h-[300px] items-center justify-center text-muted-foreground">
        <p>No Fear & Greed data available.</p>
      </div>
    )
  }

  // Get latest value for display
  const latestValue = chartData[chartData.length - 1]?.value ?? 0

  return (
    <div>
      {/* Current value indicator */}
      <div className="mb-4 flex items-center gap-4">
        <div
          className="flex h-16 w-16 items-center justify-center rounded-full text-xl font-bold"
          style={{ backgroundColor: getSentimentColor(latestValue) + "20", color: getSentimentColor(latestValue) }}
        >
          {latestValue}
        </div>
        <div>
          <div className="text-sm font-medium" style={{ color: getSentimentColor(latestValue) }}>
            {getSentimentLabel(latestValue)}
          </div>
          <div className="text-xs text-muted-foreground">Current sentiment</div>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={300}>
        <AreaChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <defs>
            <linearGradient id="fearGreedGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#ff8200" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#ff8200" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#333" />
          {/* Zone backgrounds */}
          <ReferenceArea y1={80} y2={100} fill="#00d26a" fillOpacity={0.1} />
          <ReferenceArea y1={60} y2={80} fill="#84cc16" fillOpacity={0.1} />
          <ReferenceArea y1={40} y2={60} fill="#eab308" fillOpacity={0.1} />
          <ReferenceArea y1={20} y2={40} fill="#f97316" fillOpacity={0.1} />
          <ReferenceArea y1={0} y2={20} fill="#ef4444" fillOpacity={0.1} />
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
            domain={[0, 100]}
            ticks={[0, 25, 50, 75, 100]}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "#1a1a1a",
              border: "1px solid #333",
              borderRadius: "4px"
            }}
            labelStyle={{ color: "#999" }}
            formatter={(value) => [
              `${value} (${getSentimentLabel(Number(value))})`,
              "Fear & Greed"
            ]}
          />
          {/* Reference lines for zones */}
          <ReferenceLine y={20} stroke="#ef4444" strokeDasharray="3 3" strokeOpacity={0.5} />
          <ReferenceLine y={50} stroke="#666" strokeDasharray="3 3" />
          <ReferenceLine y={80} stroke="#00d26a" strokeDasharray="3 3" strokeOpacity={0.5} />
          <Area
            type="monotone"
            dataKey="value"
            name="Fear & Greed"
            stroke="#ff8200"
            strokeWidth={2}
            fill="url(#fearGreedGradient)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
