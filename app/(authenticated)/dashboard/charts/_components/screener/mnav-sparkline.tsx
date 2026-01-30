"use client"

import { LineChart, Line, ReferenceLine, ResponsiveContainer } from "recharts"
import { useMemo } from "react"

interface MNavSparklineProps {
  data: { date: string; mNav: number }[]
  avgMNav: number | null
}

export function MNavSparkline({ data, avgMNav }: MNavSparklineProps) {
  const { isTrendingDown, color } = useMemo(() => {
    if (data.length < 2) {
      return { isTrendingDown: false, color: "#888" }
    }
    const firstMNav = data[0].mNav
    const lastMNav = data[data.length - 1].mNav
    const trending = lastMNav < firstMNav
    return {
      isTrendingDown: trending,
      color: trending ? "#22c55e" : "#ef4444" // green if getting cheaper, red if getting more expensive
    }
  }, [data])

  if (data.length === 0) {
    return <div className="h-[30px] w-[100px]" />
  }

  return (
    <div className="h-[30px] w-[100px]">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
          {avgMNav !== null && (
            <ReferenceLine
              y={avgMNav}
              stroke="#666"
              strokeDasharray="2 2"
            />
          )}
          <Line
            type="monotone"
            dataKey="mNav"
            stroke={color}
            strokeWidth={1.5}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
