"use client"

import { useMemo, useState } from "react"
import { SignalBadge } from "./signal-badge"
import { MNavSparkline } from "./mnav-sparkline"
import type { ScreenerCompanyData } from "@/actions/snapshots"
import { cn } from "@/lib/utils"
import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react"
import Link from "next/link"

interface RelativeValueScreenerProps {
  data: ScreenerCompanyData[]
}

type SortKey = "signal" | "rank" | "ticker" | "mNav" | "deviation" | "change7d" | "btcHoldings" | "marketCap"
type SortDir = "asc" | "desc"

function getSignalScore(mNav: number | null, deviation: number | null, rank: number): number {
  // Lower score = more attractive
  if (mNav !== null && mNav < 1.0) return 1
  if (deviation !== null && deviation < -10) return 1
  if (rank <= 3 && deviation !== null && deviation < 0) return 1
  if (mNav !== null && mNav > 2.0) return 3
  if (deviation !== null && deviation > 15) return 3
  return 2
}

export function RelativeValueScreener({ data }: RelativeValueScreenerProps) {
  const [sortKey, setSortKey] = useState<SortKey>("rank")
  const [sortDir, setSortDir] = useState<SortDir>("asc")

  const sortedData = useMemo(() => {
    const sorted = [...data].sort((a, b) => {
      let comparison = 0

      switch (sortKey) {
        case "signal":
          comparison = getSignalScore(a.currentMNav, a.mNavDeviation, a.mNavRank) -
                       getSignalScore(b.currentMNav, b.mNavDeviation, b.mNavRank)
          break
        case "rank":
          comparison = a.mNavRank - b.mNavRank
          break
        case "ticker":
          comparison = a.ticker.localeCompare(b.ticker)
          break
        case "mNav":
          if (a.currentMNav === null) return 1
          if (b.currentMNav === null) return -1
          comparison = a.currentMNav - b.currentMNav
          break
        case "deviation":
          if (a.mNavDeviation === null) return 1
          if (b.mNavDeviation === null) return -1
          comparison = a.mNavDeviation - b.mNavDeviation
          break
        case "change7d":
          if (a.mNavChange7d === null) return 1
          if (b.mNavChange7d === null) return -1
          comparison = a.mNavChange7d - b.mNavChange7d
          break
        case "btcHoldings":
          if (a.btcHoldings === null) return 1
          if (b.btcHoldings === null) return -1
          comparison = b.btcHoldings - a.btcHoldings // Larger first by default
          break
        case "marketCap":
          if (a.marketCapUsd === null) return 1
          if (b.marketCapUsd === null) return -1
          comparison = b.marketCapUsd - a.marketCapUsd // Larger first by default
          break
      }

      return sortDir === "asc" ? comparison : -comparison
    })

    return sorted
  }, [data, sortKey, sortDir])

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc")
    } else {
      setSortKey(key)
      setSortDir("asc")
    }
  }

  const SortIcon = ({ columnKey }: { columnKey: SortKey }) => {
    if (sortKey !== columnKey) {
      return <ArrowUpDown className="ml-1 inline h-3 w-3 text-muted-foreground/50" />
    }
    return sortDir === "asc"
      ? <ArrowUp className="ml-1 inline h-3 w-3 text-terminal-orange" />
      : <ArrowDown className="ml-1 inline h-3 w-3 text-terminal-orange" />
  }

  if (data.length === 0) {
    return (
      <div className="flex h-[300px] items-center justify-center text-muted-foreground">
        <p>No screener data available. Daily snapshots are required.</p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border/50">
            <th
              className="cursor-pointer whitespace-nowrap px-3 py-2 text-left font-medium text-muted-foreground hover:text-foreground"
              onClick={() => handleSort("signal")}
            >
              Signal
              <SortIcon columnKey="signal" />
            </th>
            <th
              className="cursor-pointer whitespace-nowrap px-3 py-2 text-left font-medium text-muted-foreground hover:text-foreground"
              onClick={() => handleSort("rank")}
            >
              Rank
              <SortIcon columnKey="rank" />
            </th>
            <th
              className="cursor-pointer whitespace-nowrap px-3 py-2 text-left font-medium text-muted-foreground hover:text-foreground"
              onClick={() => handleSort("ticker")}
            >
              Company
              <SortIcon columnKey="ticker" />
            </th>
            <th
              className="cursor-pointer whitespace-nowrap px-3 py-2 text-right font-medium text-muted-foreground hover:text-foreground"
              onClick={() => handleSort("mNav")}
            >
              mNAV
              <SortIcon columnKey="mNav" />
            </th>
            <th
              className="cursor-pointer whitespace-nowrap px-3 py-2 text-right font-medium text-muted-foreground hover:text-foreground"
              onClick={() => handleSort("deviation")}
            >
              vs 90d Avg
              <SortIcon columnKey="deviation" />
            </th>
            <th
              className="cursor-pointer whitespace-nowrap px-3 py-2 text-right font-medium text-muted-foreground hover:text-foreground"
              onClick={() => handleSort("change7d")}
            >
              7d Δ
              <SortIcon columnKey="change7d" />
            </th>
            <th className="whitespace-nowrap px-3 py-2 text-center font-medium text-muted-foreground">
              Trend
            </th>
            <th
              className="cursor-pointer whitespace-nowrap px-3 py-2 text-right font-medium text-muted-foreground hover:text-foreground"
              onClick={() => handleSort("btcHoldings")}
            >
              BTC
              <SortIcon columnKey="btcHoldings" />
            </th>
            <th
              className="cursor-pointer whitespace-nowrap px-3 py-2 text-right font-medium text-muted-foreground hover:text-foreground"
              onClick={() => handleSort("marketCap")}
            >
              Mkt Cap
              <SortIcon columnKey="marketCap" />
            </th>
          </tr>
        </thead>
        <tbody>
          {sortedData.map((company) => (
            <tr
              key={company.ticker}
              className="border-b border-border/30 transition-colors hover:bg-muted/30"
            >
              <td className="px-3 py-2">
                <SignalBadge
                  mNav={company.currentMNav}
                  deviation={company.mNavDeviation}
                  rank={company.mNavRank}
                />
              </td>
              <td className="px-3 py-2 text-muted-foreground">
                #{company.mNavRank}
              </td>
              <td className="px-3 py-2">
                <Link
                  href={`?tab=company&company=${company.ticker}`}
                  className="hover:text-terminal-orange"
                >
                  <span className="font-medium">{company.ticker}</span>
                  <span className="ml-2 text-xs text-muted-foreground">
                    {company.companyName}
                  </span>
                </Link>
              </td>
              <td className="px-3 py-2 text-right">
                <span
                  className={cn(
                    "font-mono",
                    company.currentMNav !== null && company.currentMNav < 1.0 && "text-green-400",
                    company.currentMNav !== null && company.currentMNav > 2.0 && "text-red-400"
                  )}
                >
                  {company.currentMNav !== null
                    ? `${company.currentMNav.toFixed(2)}x`
                    : "—"}
                </span>
              </td>
              <td className="px-3 py-2 text-right">
                <span
                  className={cn(
                    "font-mono",
                    company.mNavDeviation !== null && company.mNavDeviation < 0 && "text-green-400",
                    company.mNavDeviation !== null && company.mNavDeviation > 0 && "text-red-400"
                  )}
                >
                  {company.mNavDeviation !== null
                    ? `${company.mNavDeviation > 0 ? "+" : ""}${company.mNavDeviation.toFixed(1)}%`
                    : "—"}
                </span>
              </td>
              <td className="px-3 py-2 text-right">
                <span
                  className={cn(
                    "font-mono text-xs",
                    company.mNavChange7d !== null && company.mNavChange7d < 0 && "text-green-400",
                    company.mNavChange7d !== null && company.mNavChange7d > 0 && "text-red-400"
                  )}
                >
                  {company.mNavChange7d !== null
                    ? `${company.mNavChange7d > 0 ? "+" : ""}${company.mNavChange7d.toFixed(2)}`
                    : "—"}
                </span>
              </td>
              <td className="px-3 py-2">
                <div className="flex justify-center">
                  <MNavSparkline
                    data={company.mNavHistory}
                    avgMNav={company.avgMNav90d}
                  />
                </div>
              </td>
              <td className="px-3 py-2 text-right font-mono text-xs">
                {company.btcHoldings !== null
                  ? company.btcHoldings.toLocaleString(undefined, { maximumFractionDigits: 0 })
                  : "—"}
              </td>
              <td className="px-3 py-2 text-right font-mono text-xs">
                {company.marketCapUsd !== null
                  ? formatMarketCap(company.marketCapUsd)
                  : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function formatMarketCap(value: number): string {
  if (value >= 1e12) {
    return `$${(value / 1e12).toFixed(1)}T`
  }
  if (value >= 1e9) {
    return `$${(value / 1e9).toFixed(1)}B`
  }
  if (value >= 1e6) {
    return `$${(value / 1e6).toFixed(1)}M`
  }
  return `$${value.toLocaleString()}`
}
