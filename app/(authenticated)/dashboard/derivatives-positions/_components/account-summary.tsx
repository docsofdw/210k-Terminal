"use client"

import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import type { ClearStreetPnlSummary } from "@/types/clear-street"

interface AccountSummaryProps {
  pnl: ClearStreetPnlSummary | null
  totalDelta: number
  totalGamma: number
  totalTheta: number
  totalVega: number
  isLoading?: boolean
}

function formatCurrency(value: number): string {
  const absValue = Math.abs(value)
  if (absValue >= 1000000) {
    return `${value >= 0 ? "" : "-"}$${(absValue / 1000000).toFixed(2)}M`
  }
  if (absValue >= 1000) {
    return `${value >= 0 ? "" : "-"}$${(absValue / 1000).toFixed(1)}K`
  }
  return `${value >= 0 ? "" : "-"}$${absValue.toFixed(2)}`
}

function formatGreek(value: number, decimals: number = 0): string {
  if (Math.abs(value) >= 1000) {
    return `${value >= 0 ? "+" : ""}${(value / 1000).toFixed(1)}K`
  }
  return `${value >= 0 ? "+" : ""}${value.toFixed(decimals)}`
}

interface SummaryCardProps {
  title: string
  value: string
  subtitle?: string
  positive?: boolean
  negative?: boolean
  isLoading?: boolean
}

function SummaryCard({
  title,
  value,
  subtitle,
  positive,
  negative,
  isLoading
}: SummaryCardProps) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground">{title}</p>
        {isLoading ? (
          <div className="h-7 w-20 animate-pulse rounded bg-muted" />
        ) : (
          <p
            className={cn(
              "text-xl font-bold",
              positive && "text-green-500",
              negative && "text-red-500"
            )}
          >
            {value}
          </p>
        )}
        {subtitle && (
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        )}
      </CardContent>
    </Card>
  )
}

export function AccountSummary({
  pnl,
  totalDelta,
  totalGamma,
  totalTheta,
  totalVega,
  isLoading
}: AccountSummaryProps) {
  const dayPnl = pnl?.day_pnl ?? 0
  const unrealizedPnl = pnl?.unrealized_pnl ?? 0
  const longMV = pnl?.long_market_value ?? 0
  const shortMV = pnl?.short_market_value ?? 0

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-6">
      <SummaryCard
        title="Day P&L"
        value={formatCurrency(dayPnl)}
        positive={dayPnl > 0}
        negative={dayPnl < 0}
        isLoading={isLoading}
      />
      <SummaryCard
        title="Unrealized P&L"
        value={formatCurrency(unrealizedPnl)}
        positive={unrealizedPnl > 0}
        negative={unrealizedPnl < 0}
        isLoading={isLoading}
      />
      <SummaryCard
        title="Long MV"
        value={formatCurrency(longMV)}
        isLoading={isLoading}
      />
      <SummaryCard
        title="Short MV"
        value={formatCurrency(Math.abs(shortMV))}
        isLoading={isLoading}
      />
      <SummaryCard
        title="Net Delta"
        value={formatGreek(totalDelta)}
        subtitle="shares equivalent"
        positive={totalDelta > 0}
        negative={totalDelta < 0}
        isLoading={isLoading}
      />
      <SummaryCard
        title="Theta"
        value={formatCurrency(totalTheta)}
        subtitle="daily decay"
        positive={totalTheta > 0}
        negative={totalTheta < 0}
        isLoading={isLoading}
      />
    </div>
  )
}

interface GreeksSummaryProps {
  totalDelta: number
  totalGamma: number
  totalTheta: number
  totalVega: number
  realDelta?: number
  simulatedDelta?: number
  isLoading?: boolean
}

export function GreeksSummary({
  totalDelta,
  totalGamma,
  totalTheta,
  totalVega,
  realDelta,
  simulatedDelta,
  isLoading
}: GreeksSummaryProps) {
  return (
    <div className="grid grid-cols-4 gap-3">
      <Card>
        <CardContent className="p-3">
          <p className="text-xs text-muted-foreground">Delta</p>
          {isLoading ? (
            <div className="h-6 w-16 animate-pulse rounded bg-muted" />
          ) : (
            <>
              <p
                className={cn(
                  "text-lg font-bold",
                  totalDelta > 0 && "text-green-500",
                  totalDelta < 0 && "text-red-500"
                )}
              >
                {formatGreek(totalDelta)}
              </p>
              {realDelta !== undefined && simulatedDelta !== undefined && (
                <p className="text-xs text-muted-foreground">
                  Real: {formatGreek(realDelta)} | Sim:{" "}
                  {formatGreek(simulatedDelta)}
                </p>
              )}
            </>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-3">
          <p className="text-xs text-muted-foreground">Gamma</p>
          {isLoading ? (
            <div className="h-6 w-16 animate-pulse rounded bg-muted" />
          ) : (
            <p className="text-lg font-bold">{formatGreek(totalGamma, 2)}</p>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-3">
          <p className="text-xs text-muted-foreground">Theta</p>
          {isLoading ? (
            <div className="h-6 w-16 animate-pulse rounded bg-muted" />
          ) : (
            <p
              className={cn(
                "text-lg font-bold",
                totalTheta > 0 && "text-green-500",
                totalTheta < 0 && "text-red-500"
              )}
            >
              {formatCurrency(totalTheta)}
            </p>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-3">
          <p className="text-xs text-muted-foreground">Vega</p>
          {isLoading ? (
            <div className="h-6 w-16 animate-pulse rounded bg-muted" />
          ) : (
            <p className="text-lg font-bold">{formatGreek(totalVega, 2)}</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
