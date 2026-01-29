"use client"

import { useState, useMemo } from "react"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ReferenceLine
} from "recharts"

interface FundReturnsData {
  date: Date
  netReturnMtd: number | null
  btcReturnMtd: number | null
  alpha: number | null
}

interface FundReturnsChartProps {
  data: FundReturnsData[]
}

const COLORS = {
  positive: "#00d26a",
  negative: "#ef4444",
  btc: "#f7931a"
}

export function FundReturnsChart({ data }: FundReturnsChartProps) {
  // Get unique years from data
  const years = useMemo(() => {
    const yearSet = new Set<number>()
    data.forEach(item => {
      yearSet.add(new Date(item.date).getFullYear())
    })
    return Array.from(yearSet).sort((a, b) => b - a) // Most recent first
  }, [data])

  const [selectedYear, setSelectedYear] = useState<number | "all">("all")

  // Filter data by selected year
  const filteredData = useMemo(() => {
    if (selectedYear === "all") return data
    return data.filter(item => new Date(item.date).getFullYear() === selectedYear)
  }, [data, selectedYear])

  const chartData = filteredData
    .filter(item => item.netReturnMtd !== null)
    .map(item => ({
      date: new Date(item.date).toLocaleDateString("en-US", {
        month: "short",
        year: "2-digit"
      }),
      fullDate: item.date,
      fundReturn: item.netReturnMtd,
      btcReturn: item.btcReturnMtd,
      alpha: item.alpha
    }))

  // Calculate interval for X-axis labels (show ~12 labels max)
  const labelInterval = Math.max(1, Math.floor(chartData.length / 12))

  if (chartData.length === 0) {
    return (
      <div className="flex h-[300px] items-center justify-center text-muted-foreground">
        <p>No monthly returns data available. Sync will run on the 1st and 15th of each month.</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Year Filter */}
      <div className="flex items-center justify-end gap-1">
        <button
          onClick={() => setSelectedYear("all")}
          className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
            selectedYear === "all"
              ? "bg-muted text-terminal-orange"
              : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
          }`}
        >
          All
        </button>
        {years.map(year => (
          <button
            key={year}
            onClick={() => setSelectedYear(year)}
            className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
              selectedYear === year
                ? "bg-muted text-terminal-orange"
                : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
            }`}
          >
            {year}
          </button>
        ))}
      </div>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#333" />
          <XAxis
            dataKey="date"
            stroke="#666"
            fontSize={11}
            tickLine={false}
            interval={selectedYear === "all" ? labelInterval - 1 : 0}
            angle={-45}
            textAnchor="end"
            height={60}
          />
          <YAxis
            stroke="#666"
            fontSize={12}
            tickLine={false}
            tickFormatter={(value) => `${value.toFixed(0)}%`}
            domain={["auto", "auto"]}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "#1a1a1a",
              border: "1px solid #333",
              borderRadius: "4px"
            }}
            labelStyle={{ color: "#ccc" }}
            formatter={(value, name) => {
              const numValue = Number(value)
              if (name === "fundReturn") {
                const color = numValue >= 0 ? COLORS.positive : COLORS.negative
                return [
                  <span key="fund" style={{ color }}>
                    {numValue?.toFixed(2)}%
                  </span>,
                  <span key="fund-label" style={{ color: "#ccc" }}>Fund Return</span>
                ]
              }
              if (name === "btcReturn") {
                return [
                  <span key="btc" style={{ color: COLORS.btc }}>
                    {numValue?.toFixed(2)}%
                  </span>,
                  <span key="btc-label" style={{ color: "#ccc" }}>BTC Return</span>
                ]
              }
              return [`${numValue?.toFixed(2)}%`, String(name)]
            }}
          />
          <ReferenceLine y={0} stroke="#666" />
          <Bar dataKey="fundReturn" name="fundReturn" radius={[4, 4, 0, 0]}>
            {chartData.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={(entry.fundReturn ?? 0) >= 0 ? COLORS.positive : COLORS.negative}
              />
            ))}
          </Bar>
          <Bar dataKey="btcReturn" name="btcReturn" fill={COLORS.btc} radius={[4, 4, 0, 0]} opacity={0.6} />
        </BarChart>
      </ResponsiveContainer>

      {/* Custom Legend */}
      <div className="flex items-center justify-center gap-6 text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <div className="flex gap-0.5">
            <div className="h-3 w-3 rounded-sm" style={{ backgroundColor: COLORS.positive }} />
            <div className="h-3 w-3 rounded-sm" style={{ backgroundColor: COLORS.negative }} />
          </div>
          <span>Fund Return</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-sm" style={{ backgroundColor: COLORS.btc, opacity: 0.6 }} />
          <span>BTC Return</span>
        </div>
      </div>
    </div>
  )
}
