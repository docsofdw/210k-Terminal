"use client"

import { useMemo } from "react"
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts"
import type { OptionLeg } from "@/types/derivatives"

interface PnLChartProps {
  legs: OptionLeg[]
  underlyingPrice: number
  btcPrice: number
}

interface ChartDataPoint {
  price: number
  pnl: number
  profit: number | null
  loss: number | null
  btcPrice: number
}

export function PnLChart({ legs, underlyingPrice, btcPrice }: PnLChartProps) {
  const chartData = useMemo(() => {
    if (legs.length === 0) return []

    const strikes = legs.map(l => l.contract.strike)
    const minStrike = Math.min(...strikes, underlyingPrice)
    const maxStrike = Math.max(...strikes, underlyingPrice)

    // Generate price range
    const rangeMin = Math.max(0.01, minStrike * 0.7)
    const rangeMax = maxStrike * 1.3
    const step = (rangeMax - rangeMin) / 80

    // Helper to calculate P&L at a given price
    const calculatePnlAtPrice = (price: number): number => {
      let pnl = 0
      for (const leg of legs) {
        const { contract, action, quantity } = leg
        const premium = contract.mid ?? contract.last ?? 0
        let intrinsicValue: number
        if (contract.type === "call") {
          intrinsicValue = Math.max(0, price - contract.strike)
        } else {
          intrinsicValue = Math.max(0, contract.strike - price)
        }
        const legPnl =
          action === "buy"
            ? (intrinsicValue - premium) * quantity * 100
            : (premium - intrinsicValue) * quantity * 100
        pnl += legPnl
      }
      return pnl
    }

    const ratio = underlyingPrice / btcPrice
    const rawData: { price: number; pnl: number }[] = []

    for (let price = rangeMin; price <= rangeMax; price += step) {
      rawData.push({ price, pnl: calculatePnlAtPrice(price) })
    }

    // Insert zero-crossing points for smooth color transitions
    const dataWithZeroCrossings: { price: number; pnl: number }[] = []
    for (let i = 0; i < rawData.length; i++) {
      const curr = rawData[i]
      dataWithZeroCrossings.push(curr)

      if (i < rawData.length - 1) {
        const next = rawData[i + 1]
        // Check if zero crossing occurs between these points
        if ((curr.pnl < 0 && next.pnl > 0) || (curr.pnl > 0 && next.pnl < 0)) {
          // Linear interpolation to find exact zero crossing
          const t = Math.abs(curr.pnl) / (Math.abs(curr.pnl) + Math.abs(next.pnl))
          const zeroPrice = curr.price + t * (next.price - curr.price)
          dataWithZeroCrossings.push({ price: zeroPrice, pnl: 0 })
        }
      }
    }

    // Convert to chart data format
    const data: ChartDataPoint[] = dataWithZeroCrossings.map(d => {
      const roundedPnl = Math.round(d.pnl * 100) / 100
      return {
        price: Math.round(d.price * 100) / 100,
        pnl: roundedPnl,
        profit: roundedPnl >= 0 ? roundedPnl : null,
        loss: roundedPnl < 0 ? roundedPnl : null,
        btcPrice: Math.round(d.price / ratio)
      }
    })

    return data
  }, [legs, underlyingPrice, btcPrice])

  if (legs.length === 0 || chartData.length === 0) {
    return (
      <div className="flex h-[300px] items-center justify-center text-sm text-muted-foreground">
        Add legs to see P&L chart
      </div>
    )
  }

  const maxPnl = Math.max(...chartData.map(d => d.pnl))
  const minPnl = Math.min(...chartData.map(d => d.pnl))
  const breakevens = findBreakevens(chartData)

  return (
    <div className="space-y-2">
      <ResponsiveContainer width="100%" height={300}>
        <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="profitGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#22c55e" stopOpacity={0.3} />
              <stop offset="100%" stopColor="#22c55e" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="lossGradient" x1="0" y1="1" x2="0" y2="0">
              <stop offset="0%" stopColor="#ef4444" stopOpacity={0.3} />
              <stop offset="100%" stopColor="#ef4444" stopOpacity={0} />
            </linearGradient>
          </defs>

          <CartesianGrid strokeDasharray="3 3" stroke="#333" />

          <XAxis
            dataKey="price"
            tick={{ fill: "#888", fontSize: 11 }}
            tickFormatter={(v) => `$${v}`}
            stroke="#444"
          />

          <YAxis
            tick={{ fill: "#888", fontSize: 11 }}
            tickFormatter={(v) => `$${v}`}
            stroke="#444"
            domain={[minPnl * 1.1, maxPnl * 1.1]}
          />

          <Tooltip
            contentStyle={{
              backgroundColor: "#1a1a1a",
              border: "1px solid #333",
              borderRadius: "8px",
              fontSize: "12px"
            }}
            formatter={(value, name) => {
              if (name === "pnl" && typeof value === "number") {
                const formatted = `${value >= 0 ? "+" : ""}$${value.toLocaleString()}`
                return [formatted, "P&L"]
              }
              // Hide profit/loss individual entries in tooltip
              if (name === "profit" || name === "loss") {
                return null
              }
              return [value, name]
            }}
            labelFormatter={(price) => {
              const point = chartData.find(d => d.price === price)
              if (point) {
                return `Stock: $${price} | BTC: $${point.btcPrice.toLocaleString()}`
              }
              return `Stock: $${price}`
            }}
          />

          {/* Zero line */}
          <ReferenceLine y={0} stroke="#666" strokeWidth={2} />

          {/* Current price line */}
          <ReferenceLine
            x={Math.round(underlyingPrice * 100) / 100}
            stroke="#f97316"
            strokeDasharray="5 5"
            label={{
              value: "Current",
              position: "top",
              fill: "#f97316",
              fontSize: 10
            }}
          />

          {/* Breakeven lines */}
          {breakevens.map((be, i) => (
            <ReferenceLine
              key={i}
              x={be}
              stroke="#888"
              strokeDasharray="3 3"
              label={{
                value: `BE $${be}`,
                position: "bottom",
                fill: "#888",
                fontSize: 9
              }}
            />
          ))}

          {/* Profit area (green) */}
          <Area
            type="monotone"
            dataKey="profit"
            stroke="#22c55e"
            fill="url(#profitGradient)"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, fill: "#22c55e" }}
            isAnimationActive={false}
            connectNulls={false}
            baseValue={0}
          />

          {/* Loss area (red) */}
          <Area
            type="monotone"
            dataKey="loss"
            stroke="#ef4444"
            fill="url(#lossGradient)"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, fill: "#ef4444" }}
            isAnimationActive={false}
            connectNulls={false}
            baseValue={0}
          />

          {/* P&L line overlay for continuous stroke */}
          <Area
            type="monotone"
            dataKey="pnl"
            stroke="#888"
            fill="transparent"
            strokeWidth={2}
            dot={false}
            activeDot={false}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>

      {/* Legend */}
      <div className="flex flex-wrap items-center justify-center gap-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-1">
          <div className="h-0.5 w-4 bg-[#f97316]" style={{ borderStyle: "dashed" }} />
          <span>Current: ${underlyingPrice.toFixed(2)}</span>
        </div>
        {breakevens.length > 0 && (
          <div className="flex items-center gap-1">
            <div className="h-0.5 w-4 bg-[#888]" />
            <span>Breakeven: {breakevens.map(b => `$${b}`).join(", ")}</span>
          </div>
        )}
        <div className="flex items-center gap-1">
          <div className="h-3 w-3 rounded bg-green-500/30" />
          <span>Profit</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="h-3 w-3 rounded bg-red-500/30" />
          <span>Loss</span>
        </div>
      </div>
    </div>
  )
}

// Find breakeven points (where P&L crosses zero)
function findBreakevens(data: ChartDataPoint[]): number[] {
  const breakevens: number[] = []

  for (let i = 1; i < data.length; i++) {
    const prev = data[i - 1]
    const curr = data[i]

    // Check if sign changed
    if ((prev.pnl < 0 && curr.pnl >= 0) || (prev.pnl >= 0 && curr.pnl < 0)) {
      // Linear interpolation to find exact breakeven
      const ratio = Math.abs(prev.pnl) / (Math.abs(prev.pnl) + Math.abs(curr.pnl))
      const breakeven = prev.price + ratio * (curr.price - prev.price)
      breakevens.push(Math.round(breakeven * 100) / 100)
    }
  }

  return breakevens
}
