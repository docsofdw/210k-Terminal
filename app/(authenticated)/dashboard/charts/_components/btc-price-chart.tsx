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
import type { SelectMarketSnapshot } from "@/db/schema/daily-snapshots"

interface BtcPriceChartProps {
  data: SelectMarketSnapshot[]
}

export function BtcPriceChart({ data }: BtcPriceChartProps) {
  const chartData = data.map(snapshot => ({
    date: new Date(snapshot.snapshotDate).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric"
    }),
    fullDate: snapshot.snapshotDate,
    btcPrice: snapshot.btcPrice ? parseFloat(snapshot.btcPrice) : 0
  }))

  if (chartData.length === 0) {
    return (
      <div className="flex h-[300px] items-center justify-center text-muted-foreground">
        <p>No BTC price data available. Run the daily snapshot cron to generate data.</p>
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
          tickFormatter={(value) =>
            "$" +
            new Intl.NumberFormat("en-US", {
              notation: "compact",
              maximumFractionDigits: 0
            }).format(value)
          }
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
            "$" +
              new Intl.NumberFormat("en-US", {
                maximumFractionDigits: 0
              }).format(Number(value)),
            "BTC Price"
          ]}
        />
        <Line
          type="monotone"
          dataKey="btcPrice"
          name="BTC Price"
          stroke="#f7931a"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4, fill: "#f7931a" }}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
