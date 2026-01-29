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

interface PiCycleChartProps {
  data: OnChainMetricDataPoint[]
}

export function PiCycleChart({ data }: PiCycleChartProps) {
  const chartData = data.map(point => {
    // API returns: Price, 111day_avg, 350day_avg
    // Pi Cycle Top uses 111 DMA and 350 DMA x2
    const price = (point["Price"] as number) ?? 0
    const ma111 = (point["111day_avg"] as number) ?? 0
    const ma350 = (point["350day_avg"] as number) ?? 0

    return {
      date: new Date(point.date).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric"
      }),
      fullDate: point.date,
      price,
      ma111,
      ma350x2: ma350 * 2 // Pi Cycle uses 350 DMA multiplied by 2
    }
  })

  if (chartData.length === 0) {
    return (
      <div className="flex h-[300px] items-center justify-center text-muted-foreground">
        <p>No Pi Cycle data available.</p>
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
            "$" + new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(Number(value)),
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
          dataKey="ma111"
          name="111 DMA"
          stroke="#00d26a"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4, fill: "#00d26a" }}
        />
        <Line
          type="monotone"
          dataKey="ma350x2"
          name="350 DMA x2"
          stroke="#ef4444"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4, fill: "#ef4444" }}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
