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

interface MvrvZScoreChartProps {
  data: OnChainMetricDataPoint[]
}

function getZScoreZone(value: number): { label: string; color: string } {
  if (value >= 7) return { label: "Extreme Overvalued", color: "#ef4444" }
  if (value >= 5) return { label: "Overvalued", color: "#f97316" }
  if (value >= 3) return { label: "Fairly Valued (High)", color: "#eab308" }
  if (value >= 0) return { label: "Fairly Valued", color: "#84cc16" }
  return { label: "Undervalued", color: "#00d26a" }
}

export function MvrvZScoreChart({ data }: MvrvZScoreChartProps) {
  const chartData = data.map(point => {
    const zScore = (point["ZScore"] as number) ?? 0

    return {
      date: new Date(point.date).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric"
      }),
      fullDate: point.date,
      zScore
    }
  })

  if (chartData.length === 0) {
    return (
      <div className="flex h-[300px] items-center justify-center text-muted-foreground">
        <p>No MVRV Z-Score data available.</p>
      </div>
    )
  }

  const latestZScore = chartData[chartData.length - 1]?.zScore ?? 0
  const zone = getZScoreZone(latestZScore)

  return (
    <div>
      <div className="mb-4 flex items-center gap-4">
        <div
          className="flex h-16 w-16 items-center justify-center rounded-full text-xl font-bold"
          style={{ backgroundColor: zone.color + "20", color: zone.color }}
        >
          {latestZScore.toFixed(1)}
        </div>
        <div>
          <div className="text-sm font-medium" style={{ color: zone.color }}>
            {zone.label}
          </div>
          <div className="text-xs text-muted-foreground">Current Z-Score</div>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={300}>
        <AreaChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <defs>
            <linearGradient id="mvrvGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#ff8200" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#ff8200" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#333" />
          {/* Zone backgrounds */}
          <ReferenceArea y1={7} y2={10} fill="#ef4444" fillOpacity={0.1} />
          <ReferenceArea y1={5} y2={7} fill="#f97316" fillOpacity={0.1} />
          <ReferenceArea y1={3} y2={5} fill="#eab308" fillOpacity={0.1} />
          <ReferenceArea y1={0} y2={3} fill="#84cc16" fillOpacity={0.1} />
          <ReferenceArea y1={-2} y2={0} fill="#00d26a" fillOpacity={0.1} />
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
            domain={[-1, 8]}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "#1a1a1a",
              border: "1px solid #333",
              borderRadius: "4px"
            }}
            labelStyle={{ color: "#999" }}
            formatter={(value) => [
              `${Number(value).toFixed(2)} (${getZScoreZone(Number(value)).label})`,
              "Z-Score"
            ]}
          />
          <ReferenceLine y={7} stroke="#ef4444" strokeDasharray="3 3" strokeOpacity={0.7} />
          <ReferenceLine y={5} stroke="#f97316" strokeDasharray="3 3" strokeOpacity={0.7} />
          <ReferenceLine y={3} stroke="#eab308" strokeDasharray="3 3" strokeOpacity={0.7} />
          <ReferenceLine y={0} stroke="#666" strokeDasharray="3 3" />
          <Area
            type="monotone"
            dataKey="zScore"
            name="Z-Score"
            stroke="#ff8200"
            strokeWidth={2}
            fill="url(#mvrvGradient)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
