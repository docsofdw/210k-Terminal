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
import type { SelectDailySnapshot } from "@/db/schema/daily-snapshots"

interface CompanyMNavChartProps {
  data: SelectDailySnapshot[]
  companyName: string
}

export function CompanyMNavChart({ data, companyName }: CompanyMNavChartProps) {
  const chartData = data.map(snapshot => ({
    date: new Date(snapshot.snapshotDate).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric"
    }),
    mNav: snapshot.mNav ? parseFloat(snapshot.mNav) : null,
    stockPriceUsd: snapshot.stockPriceUsd ? parseFloat(snapshot.stockPriceUsd) : null,
    btcHoldings: snapshot.btcHoldings ? parseFloat(snapshot.btcHoldings) : null
  }))

  if (chartData.length === 0) {
    return (
      <div className="flex h-[300px] items-center justify-center text-muted-foreground">
        <p>No historical data available for {companyName}.</p>
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
          formatter={(value) => [`${Number(value).toFixed(3)}x`, "mNAV"]}
        />
        <Line
          type="monotone"
          dataKey="mNav"
          name="mNAV"
          stroke="#ff8200"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4 }}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
