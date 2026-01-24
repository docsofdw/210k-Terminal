"use client"

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from "recharts"
import type { SelectMarketSnapshot } from "@/db/schema/daily-snapshots"

interface HoldingsChartProps {
  data: SelectMarketSnapshot[]
}

export function HoldingsChart({ data }: HoldingsChartProps) {
  const chartData = data.map(snapshot => ({
    date: new Date(snapshot.snapshotDate).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric"
    }),
    fullDate: snapshot.snapshotDate,
    totalBtcHoldings: snapshot.totalBtcHoldings
      ? parseFloat(snapshot.totalBtcHoldings)
      : 0,
    totalBtcNav: snapshot.totalBtcNav
      ? parseFloat(snapshot.totalBtcNav) / 1_000_000_000
      : 0, // Convert to billions
    btcPrice: snapshot.btcPrice ? parseFloat(snapshot.btcPrice) : 0
  }))

  if (chartData.length === 0) {
    return (
      <div className="flex h-[300px] items-center justify-center text-muted-foreground">
        <p>No holdings data available. Run the daily snapshot cron to generate data.</p>
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <AreaChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
        <defs>
          <linearGradient id="holdingsGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#ff8200" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#ff8200" stopOpacity={0} />
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
          tickFormatter={(value) =>
            new Intl.NumberFormat("en-US", {
              notation: "compact",
              maximumFractionDigits: 0
            }).format(value)
          }
        />
        <Tooltip
          contentStyle={{
            backgroundColor: "#1a1a1a",
            border: "1px solid #333",
            borderRadius: "4px"
          }}
          labelStyle={{ color: "#999" }}
          formatter={(value) => [
            new Intl.NumberFormat("en-US", {
              maximumFractionDigits: 0
            }).format(Number(value)) + " BTC",
            "Total Holdings"
          ]}
        />
        <Area
          type="monotone"
          dataKey="totalBtcHoldings"
          name="Total BTC Holdings"
          stroke="#ff8200"
          strokeWidth={2}
          fill="url(#holdingsGradient)"
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}
