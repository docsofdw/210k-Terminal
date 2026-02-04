"use client"

import { useState } from "react"
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from "@/components/ui/tooltip"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Plus, AlertCircle, TrendingUp, TrendingDown } from "lucide-react"
import { cn } from "@/lib/utils"
import type { EnrichedPosition } from "@/types/clear-street"
import {
  formatExpiration,
  formatStrike,
  daysToExpiration
} from "@/lib/utils/occ-parser"

interface PositionsTableProps {
  positions: EnrichedPosition[]
  onAddToBuilder: (position: EnrichedPosition) => void
  isLoading?: boolean
}

function formatCurrency(value: number | null): string {
  if (value === null) return "N/A"
  const absValue = Math.abs(value)
  const sign = value >= 0 ? "" : "-"
  if (absValue >= 1000000) {
    return `${sign}$${(absValue / 1000000).toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 2 })}M`
  }
  if (absValue >= 10000) {
    return `${sign}$${(absValue / 1000).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}K`
  }
  return `${sign}$${absValue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function formatPercent(value: number | null): string {
  if (value === null) return "N/A"
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`
}

function formatGreek(value: number | null, decimals: number = 2): string {
  if (value === null) return "N/A"
  return value.toFixed(decimals)
}

function formatIV(value: number | null): string {
  if (value === null) return "N/A"
  return `${(value * 100).toFixed(0)}%`
}

function formatDelta(value: number | null): string {
  if (value === null) return "N/A"
  const absValue = Math.abs(value)
  const sign = value >= 0 ? "+" : "-"
  if (absValue >= 1000000) {
    return `${sign}${(absValue / 1000000).toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}M`
  }
  if (absValue >= 1000) {
    return `${sign}${(absValue / 1000).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 1 })}K`
  }
  return `${sign}${absValue.toLocaleString("en-US", { maximumFractionDigits: 0 })}`
}

export function PositionsTable({
  positions,
  onAddToBuilder,
  isLoading
}: PositionsTableProps) {
  const [sortBy, setSortBy] = useState<string>("underlying")

  // Filter to only show options
  const optionPositions = positions.filter((p) => p.isOption)

  // Calculate totals
  const totals = {
    contracts: optionPositions.reduce((sum, p) => sum + p.quantity, 0),
    marketValue: optionPositions.reduce((sum, p) => sum + p.marketValue, 0),
    dayPnl: optionPositions.reduce((sum, p) => sum + p.dayPnl, 0),
    unrealizedPnl: optionPositions.reduce((sum, p) => sum + p.unrealizedPnl, 0),
    delta: optionPositions.reduce((sum, p) => sum + p.deltaExposure, 0),
    theta: optionPositions.reduce((sum, p) => sum + p.thetaExposure, 0),
    gamma: optionPositions.reduce((sum, p) => sum + p.gammaExposure, 0),
    vega: optionPositions.reduce((sum, p) => sum + p.vegaExposure, 0)
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Clear Street Positions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex h-32 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-terminal-orange" />
          </div>
        </CardContent>
      </Card>
    )
  }

  if (optionPositions.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Clear Street Positions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex h-32 flex-col items-center justify-center text-muted-foreground">
            <AlertCircle className="mb-2 h-8 w-8" />
            <p>No derivative positions found</p>
            <p className="text-xs">
              Positions will appear here once synced from Clear Street
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">
            Clear Street Positions ({optionPositions.length})
          </CardTitle>
          <Badge variant="outline" className="text-xs">
            Real Positions
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[140px]">Position</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead className="text-right">SOD</TableHead>
                <TableHead className="text-right">Current</TableHead>
                <TableHead className="text-right">Day P&L</TableHead>
                <TableHead className="text-right">Delta</TableHead>
                <TableHead className="text-right">IV</TableHead>
                <TableHead className="text-right">DTE</TableHead>
                <TableHead className="w-[60px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {optionPositions.map((position) => {
                const dte = position.expiration
                  ? daysToExpiration(position.expiration)
                  : null
                const isLong = position.quantity > 0
                const isCall = position.optionType === "call"

                return (
                  <TableRow key={position.clearStreetSymbol}>
                    <TableCell>
                      <div className="flex flex-col">
                        <div className="flex items-center gap-1.5">
                          <span className="font-medium">
                            {position.underlying}
                          </span>
                          <Badge
                            variant={isCall ? "default" : "secondary"}
                            className={cn(
                              "h-4 px-1 text-[10px]",
                              isCall
                                ? "bg-green-500/20 text-green-500"
                                : "bg-red-500/20 text-red-500"
                            )}
                          >
                            {isCall ? "C" : "P"}
                          </Badge>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          ${position.strike ? formatStrike(position.strike) : "N/A"}{" "}
                          {position.expiration
                            ? formatExpiration(position.expiration)
                            : "N/A"}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell
                      className={cn(
                        "text-right font-medium font-mono",
                        isLong ? "text-green-500" : "text-red-500"
                      )}
                    >
                      {isLong ? "+" : ""}
                      {position.quantity.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      ${position.sodPrice.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right">
                      ${position.currentPrice.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right">
                      <span
                        className={cn(
                          "font-medium",
                          position.dayPnl > 0 && "text-green-500",
                          position.dayPnl < 0 && "text-red-500"
                        )}
                      >
                        {formatCurrency(position.dayPnl)}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger>
                            <span
                              className={cn(
                                position.deltaExposure > 0 && "text-green-500",
                                position.deltaExposure < 0 && "text-red-500"
                              )}
                            >
                              {formatDelta(position.deltaExposure)}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Contract Delta: {formatGreek(position.delta)}</p>
                            <p>
                              Position Delta: {position.deltaExposure.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </TableCell>
                    <TableCell className="text-right">
                      {formatIV(position.iv)}
                    </TableCell>
                    <TableCell className="text-right">
                      {dte !== null ? (
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-xs",
                            dte <= 7 && "border-red-500 text-red-500",
                            dte > 7 && dte <= 30 && "border-yellow-500 text-yellow-500"
                          )}
                        >
                          {dte}d
                        </Badge>
                      ) : (
                        "N/A"
                      )}
                    </TableCell>
                    <TableCell>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => onAddToBuilder(position)}
                            >
                              <Plus className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            Add to Strategy Builder
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
            <TableFooter>
              <TableRow className="bg-muted/50 font-medium">
                <TableCell>
                  <span className="text-muted-foreground">Total</span>
                </TableCell>
                <TableCell
                  className={cn(
                    "text-right",
                    totals.contracts > 0 ? "text-green-500" : "text-red-500"
                  )}
                >
                  {totals.contracts > 0 ? "+" : ""}
                  {totals.contracts.toLocaleString()}
                </TableCell>
                <TableCell className="text-right text-muted-foreground">
                  —
                </TableCell>
                <TableCell className="text-right text-muted-foreground">
                  —
                </TableCell>
                <TableCell
                  className={cn(
                    "text-right font-medium",
                    totals.dayPnl > 0 && "text-green-500",
                    totals.dayPnl < 0 && "text-red-500"
                  )}
                >
                  {formatCurrency(totals.dayPnl)}
                </TableCell>
                <TableCell
                  className={cn(
                    "text-right",
                    totals.delta > 0 && "text-green-500",
                    totals.delta < 0 && "text-red-500"
                  )}
                >
                  {formatDelta(totals.delta)}
                </TableCell>
                <TableCell className="text-right text-muted-foreground">
                  —
                </TableCell>
                <TableCell className="text-right text-muted-foreground">
                  —
                </TableCell>
                <TableCell></TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}

interface PositionsSummaryRowProps {
  positions: EnrichedPosition[]
}

export function PositionsSummaryRow({ positions }: PositionsSummaryRowProps) {
  const optionPositions = positions.filter((p) => p.isOption)

  const totalUnrealizedPnl = optionPositions.reduce(
    (sum, p) => sum + p.unrealizedPnl,
    0
  )
  const totalDelta = optionPositions.reduce(
    (sum, p) => sum + p.deltaExposure,
    0
  )
  const totalTheta = optionPositions.reduce(
    (sum, p) => sum + p.thetaExposure,
    0
  )

  return (
    <div className="flex items-center gap-4 rounded-lg border bg-muted/30 p-3">
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">Positions:</span>
        <span className="font-medium">{optionPositions.length}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">Total P&L:</span>
        <span
          className={cn(
            "font-medium",
            totalUnrealizedPnl > 0 && "text-green-500",
            totalUnrealizedPnl < 0 && "text-red-500"
          )}
        >
          {formatCurrency(totalUnrealizedPnl)}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">Net Delta:</span>
        <span
          className={cn(
            "font-medium",
            totalDelta > 0 && "text-green-500",
            totalDelta < 0 && "text-red-500"
          )}
        >
          {formatDelta(totalDelta)}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">Theta:</span>
        <span
          className={cn(
            "font-medium",
            totalTheta > 0 && "text-green-500",
            totalTheta < 0 && "text-red-500"
          )}
        >
          {formatCurrency(totalTheta)}/day
        </span>
      </div>
    </div>
  )
}
