"use client"

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from "recharts"
import type { OnChainMetricDataPoint } from "@/lib/api/bitcoin-magazine-pro"

interface Heatmap200WMAChartProps {
  data: OnChainMetricDataPoint[]
}

export function Heatmap200WMAChart({ data }: Heatmap200WMAChartProps) {
  const chartData = data.map(point => {
    // API returns: Price, 200week_avg, 200wma_monthly_increase
    const price = (point["Price"] as number) ?? 0
    const wma200 = (point["200week_avg"] as number) ?? 0

    return {
      date: new Date(point.date).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric"
      }),
      fullDate: point.date,
      price,
      wma200
    }
  })

  if (chartData.length === 0) {
    return (
      <div className="flex h-[300px] items-center justify-center text-muted-foreground">
        <p>No 200 WMA heatmap data available.</p>
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
          formatter={(value, name) => [
            name === "200 WMA" || name === "BTC Price"
              ? "$" + new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(Number(value))
              : Number(value).toFixed(2),
            name
          ]}
        />
        <Legend />
        <Line
          type="monotone"
          dataKey="price"
          name="BTC Price"
          stroke="#ff8200"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4, fill: "#ff8200" }}
        />
        <Line
          type="monotone"
          dataKey="wma200"
          name="200 WMA"
          stroke="#00d26a"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4, fill: "#00d26a" }}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
