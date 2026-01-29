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

interface NuplChartProps {
  data: OnChainMetricDataPoint[]
}

function getNuplZone(value: number): { label: string; color: string } {
  if (value >= 0.75) return { label: "Euphoria/Greed", color: "#ef4444" }
  if (value >= 0.5) return { label: "Belief/Denial", color: "#f97316" }
  if (value >= 0.25) return { label: "Optimism/Anxiety", color: "#eab308" }
  if (value >= 0) return { label: "Hope/Fear", color: "#84cc16" }
  return { label: "Capitulation", color: "#00d26a" }
}

export function NuplChart({ data }: NuplChartProps) {
  const chartData = data.map(point => {
    const nupl = (point["NUPL"] as number) ?? 0

    return {
      date: new Date(point.date).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric"
      }),
      fullDate: point.date,
      nupl
    }
  })

  if (chartData.length === 0) {
    return (
      <div className="flex h-[300px] items-center justify-center text-muted-foreground">
        <p>No NUPL data available.</p>
      </div>
    )
  }

  const latestNupl = chartData[chartData.length - 1]?.nupl ?? 0
  const zone = getNuplZone(latestNupl)

  return (
    <div>
      <div className="mb-4 flex items-center gap-4">
        <div
          className="flex h-16 w-16 items-center justify-center rounded-full text-xl font-bold"
          style={{ backgroundColor: zone.color + "20", color: zone.color }}
        >
          {(latestNupl * 100).toFixed(0)}%
        </div>
        <div>
          <div className="text-sm font-medium" style={{ color: zone.color }}>
            {zone.label}
          </div>
          <div className="text-xs text-muted-foreground">Net Unrealized Profit/Loss</div>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={300}>
        <AreaChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <defs>
            <linearGradient id="nuplGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#ff8200" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#ff8200" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#333" />
          {/* Zone backgrounds */}
          <ReferenceArea y1={0.75} y2={1} fill="#ef4444" fillOpacity={0.1} />
          <ReferenceArea y1={0.5} y2={0.75} fill="#f97316" fillOpacity={0.1} />
          <ReferenceArea y1={0.25} y2={0.5} fill="#eab308" fillOpacity={0.1} />
          <ReferenceArea y1={0} y2={0.25} fill="#84cc16" fillOpacity={0.1} />
          <ReferenceArea y1={-0.5} y2={0} fill="#00d26a" fillOpacity={0.1} />
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
            domain={[-0.25, 1]}
            tickFormatter={(value) => `${(value * 100).toFixed(0)}%`}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "#1a1a1a",
              border: "1px solid #333",
              borderRadius: "4px"
            }}
            labelStyle={{ color: "#999" }}
            formatter={(value) => [
              `${(Number(value) * 100).toFixed(1)}% (${getNuplZone(Number(value)).label})`,
              "NUPL"
            ]}
          />
          <ReferenceLine y={0.75} stroke="#ef4444" strokeDasharray="3 3" strokeOpacity={0.7} />
          <ReferenceLine y={0.5} stroke="#f97316" strokeDasharray="3 3" strokeOpacity={0.7} />
          <ReferenceLine y={0.25} stroke="#eab308" strokeDasharray="3 3" strokeOpacity={0.7} />
          <ReferenceLine y={0} stroke="#666" strokeDasharray="3 3" />
          <Area
            type="monotone"
            dataKey="nupl"
            name="NUPL"
            stroke="#ff8200"
            strokeWidth={2}
            fill="url(#nuplGradient)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
