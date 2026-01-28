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

interface CompanyPriceChartProps {
  data: SelectDailySnapshot[]
  companyName: string
  currency: string
}

export function CompanyPriceChart({ data, companyName, currency }: CompanyPriceChartProps) {
  const chartData = data.map(snapshot => ({
    date: new Date(snapshot.snapshotDate).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric"
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

  // Use local currency price if available, otherwise USD
  const priceKey = chartData[0]?.stockPrice !== null ? "stockPrice" : "stockPriceUsd"
  const displayCurrency = priceKey === "stockPrice" ? currency : "USD"

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
          tickFormatter={(value) => {
            if (displayCurrency === "USD") {
              return `$${value.toFixed(2)}`
            }
            return value.toFixed(2)
          }}
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
            `${displayCurrency === "USD" ? "$" : ""}${Number(value).toFixed(2)} ${displayCurrency}`,
            "Price"
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
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
