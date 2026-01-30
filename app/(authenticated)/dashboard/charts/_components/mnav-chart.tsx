"use client"

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from "recharts"
import type { SelectMarketSnapshot } from "@/db/schema/daily-snapshots"

interface MNavChartProps {
  data: SelectMarketSnapshot[]
}

const COLORS = {
  avgMNav: "#ff8200",
  medianMNav: "#00d26a",
  weightedAvgMNav: "#3b82f6"
}

export function MNavChart({ data }: MNavChartProps) {
  const chartData = data.map(snapshot => ({
    date: new Date(snapshot.snapshotDate).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric"
    }),
    fullDate: snapshot.snapshotDate,
    avgMNav: snapshot.avgMNav ? parseFloat(snapshot.avgMNav) : null,
    medianMNav: snapshot.medianMNav ? parseFloat(snapshot.medianMNav) : null,
    weightedAvgMNav: snapshot.weightedAvgMNav
      ? parseFloat(snapshot.weightedAvgMNav)
      : null
  }))

  if (chartData.length === 0) {
    return (
      <div className="flex h-[300px] items-center justify-center text-muted-foreground">
        <p>No D.mNAV data available. Run the daily snapshot cron to generate data.</p>
      </div>
    )
  }

  return (
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
          tickFormatter={(value) => `${value.toFixed(2)}x`}
          domain={["auto", "auto"]}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: "#1a1a1a",
            border: "1px solid #333",
            borderRadius: "4px"
          }}
          labelStyle={{ color: "#999" }}
          formatter={(value) => [`${Number(value).toFixed(3)}x`, ""]}
        />
        <Legend />
        <Line
          type="monotone"
          dataKey="avgMNav"
          name="Avg D.mNAV"
          stroke={COLORS.avgMNav}
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4 }}
        />
        <Line
          type="monotone"
          dataKey="medianMNav"
          name="Median D.mNAV"
          stroke={COLORS.medianMNav}
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4 }}
        />
        <Line
          type="monotone"
          dataKey="weightedAvgMNav"
          name="Wtd Avg D.mNAV"
          stroke={COLORS.weightedAvgMNav}
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4 }}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
