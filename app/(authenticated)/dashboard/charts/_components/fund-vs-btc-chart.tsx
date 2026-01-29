"use client"

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine
} from "recharts"

interface FundVsBtcData {
  date: Date
  fundNormalized: number
  btcNormalized: number
  fundAumUsd: number
  btcPrice: number
}

interface FundVsBtcChartProps {
  data: FundVsBtcData[]
}

const COLORS = {
  fund: "#ff8200", // Terminal orange (solid line)
  btc: "#60a5fa"   // Blue for better contrast (dashed line)
}

export function FundVsBtcChart({ data }: FundVsBtcChartProps) {
  // Convert normalized values to cumulative % returns (normalized - 100)
  const chartData = data.map((item, index) => {
    const date = new Date(item.date)
    const month = date.toLocaleDateString("en-US", { month: "short" })
    const year = date.getFullYear()

    // Show year on first data point and January of each year
    const isJanuary = date.getMonth() === 0
    const isFirst = index === 0
    const label = isFirst || isJanuary ? `${month} ${year}` : month

    return {
      index, // Use numeric index for X-axis positioning
      label,
      fullDate: date,
      month,
      year,
      // Convert to percentage change from start (e.g., 150 -> +50%, 80 -> -20%)
      fundReturn: item.fundNormalized - 100,
      btcReturn: item.btcNormalized - 100,
      fundAumUsd: item.fundAumUsd,
      btcPrice: item.btcPrice
    }
  })

  // Calculate which indices to show labels for (~10 labels total)
  const labelInterval = Math.max(1, Math.floor(chartData.length / 10))

  if (chartData.length === 0) {
    return (
      <div className="flex h-[350px] items-center justify-center text-muted-foreground">
        <p>No fund performance data available. Sync will run on the 1st and 15th of each month.</p>
      </div>
    )
  }

  // Get min/max for y-axis domain
  const allValues = chartData.flatMap(d => [d.fundReturn, d.btcReturn])
  const minVal = Math.floor(Math.min(...allValues) / 50) * 50
  const maxVal = Math.ceil(Math.max(...allValues) / 50) * 50

  return (
    <ResponsiveContainer width="100%" height={350}>
      <LineChart data={chartData} margin={{ top: 10, right: 30, left: 10, bottom: 20 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#333" />
        <XAxis
          dataKey="index"
          type="number"
          domain={[0, chartData.length - 1]}
          stroke="#888"
          fontSize={11}
          tickLine={false}
          ticks={chartData.filter((_, i) => i % labelInterval === 0).map(d => d.index)}
          tickFormatter={(value) => {
            const item = chartData.find(d => d.index === value)
            return item?.label || ""
          }}
          angle={-45}
          textAnchor="end"
          height={60}
        />
        <YAxis
          stroke="#888"
          fontSize={11}
          tickLine={false}
          tickFormatter={(value) => `${value >= 0 ? "+" : ""}${value}%`}
          domain={[minVal, maxVal]}
          width={55}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: "#1a1a1a",
            border: "1px solid #444",
            borderRadius: "6px",
            padding: "10px"
          }}
          labelStyle={{ color: "#fff", fontWeight: "bold", marginBottom: "5px" }}
          labelFormatter={(_, payload) => {
            if (payload && payload.length > 0) {
              const d = payload[0].payload
              return new Date(d.fullDate).toLocaleDateString("en-US", {
                month: "long",
                year: "numeric"
              })
            }
            return ""
          }}
          formatter={(value, name, props) => {
            const numValue = Number(value)
            const sign = numValue >= 0 ? "+" : ""
            if (name === "Fund") {
              return [
                <span key="fund" style={{ color: COLORS.fund }}>
                  {sign}{numValue.toFixed(1)}%
                </span>,
                "Fund"
              ]
            }
            if (name === "Bitcoin") {
              const price = props.payload.btcPrice
              return [
                <span key="btc" style={{ color: COLORS.btc }}>
                  {sign}{numValue.toFixed(1)}%{price > 0 ? ` ($${new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(price)})` : ""}
                </span>,
                "Bitcoin"
              ]
            }
            return [`${sign}${numValue.toFixed(1)}%`, name]
          }}
        />
        <Legend
          wrapperStyle={{ paddingTop: "10px", color: "#ccc" }}
          formatter={(value) => <span style={{ color: "#ccc" }}>{value}</span>}
        />
        <ReferenceLine y={0} stroke="#555" strokeWidth={1} />
        <Line
          type="monotone"
          dataKey="fundReturn"
          name="Fund"
          stroke={COLORS.fund}
          strokeWidth={2.5}
          dot={false}
          activeDot={{ r: 5, fill: COLORS.fund }}
        />
        <Line
          type="monotone"
          dataKey="btcReturn"
          name="Bitcoin"
          stroke={COLORS.btc}
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 5, fill: COLORS.btc }}
          strokeDasharray="6 3"
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
