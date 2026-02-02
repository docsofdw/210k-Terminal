"use client"

import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table"
import { ArrowUp, ArrowDown, Minus, TrendingUp, AlertTriangle, Target } from "lucide-react"
import type { StrategyAnalysis } from "@/types/derivatives"
import { formatBtc } from "@/lib/utils/btc-conversion"

interface AnalysisPanelProps {
  analysis: StrategyAnalysis
  underlyingPrice: number
  btcPrice: number
}

export function AnalysisPanel({
  analysis,
  underlyingPrice,
  btcPrice
}: AnalysisPanelProps) {
  const isDebit = analysis.totalCost > 0
  const isCredit = analysis.totalCost < 0

  const formatPnL = (value: number) => {
    const prefix = value > 0 ? "+" : ""
    return `${prefix}$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }

  const formatPercent = (value: number) => {
    const prefix = value > 0 ? "+" : ""
    return `${prefix}${value.toFixed(1)}%`
  }

  const formatRiskReward = (maxProfit: number | "unlimited", maxLoss: number | "unlimited") => {
    if (maxProfit === "unlimited" || maxLoss === "unlimited") return "N/A"
    if (maxLoss === 0) return "N/A"
    return (Math.abs(maxProfit) / Math.abs(maxLoss)).toFixed(2) + ":1"
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Total Cost */}
        <div className="rounded-lg border border-border/50 bg-muted/30 p-4">
          <div className="text-xs text-muted-foreground">Total Cost</div>
          <div className="mt-1 flex items-baseline gap-2">
            <span
              className={`font-mono text-2xl font-bold ${
                isDebit ? "text-red-500" : isCredit ? "text-green-500" : ""
              }`}
            >
              {isDebit ? "-" : isCredit ? "+" : ""}$
              {Math.abs(analysis.totalCost).toLocaleString()}
            </span>
            <Badge
              variant="outline"
              className={`text-[10px] ${
                isDebit ? "text-red-500" : isCredit ? "text-green-500" : ""
              }`}
            >
              {isDebit ? "Debit" : isCredit ? "Credit" : "Even"}
            </Badge>
          </div>
          {analysis.totalCostBtc && (
            <div className="mt-1 text-xs text-muted-foreground">
              {formatBtc(analysis.totalCostBtc)} BTC
            </div>
          )}
        </div>

        {/* Max Profit */}
        <div className="rounded-lg border border-border/50 bg-muted/30 p-4">
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <ArrowUp className="h-3 w-3 text-green-500" />
            Max Profit
          </div>
          <div className="mt-1">
            {analysis.maxProfit === "unlimited" ? (
              <span className="font-mono text-2xl font-bold text-green-500">
                Unlimited
              </span>
            ) : (
              <span className="font-mono text-2xl font-bold text-green-500">
                +${analysis.maxProfit.toLocaleString()}
              </span>
            )}
          </div>
          {analysis.maxProfitPrice !== null && (
            <div className="mt-1 text-xs text-muted-foreground">
              at ${analysis.maxProfitPrice.toFixed(2)}
            </div>
          )}
        </div>

        {/* Max Loss */}
        <div className="rounded-lg border border-border/50 bg-muted/30 p-4">
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <ArrowDown className="h-3 w-3 text-red-500" />
            Max Loss
          </div>
          <div className="mt-1">
            {analysis.maxLoss === "unlimited" ? (
              <div className="flex items-center gap-2">
                <span className="font-mono text-2xl font-bold text-red-500">
                  Unlimited
                </span>
                <AlertTriangle className="h-5 w-5 text-red-500" />
              </div>
            ) : (
              <span className="font-mono text-2xl font-bold text-red-500">
                -${Math.abs(analysis.maxLoss).toLocaleString()}
              </span>
            )}
          </div>
          {analysis.maxLossPrice !== null && (
            <div className="mt-1 text-xs text-muted-foreground">
              at ${analysis.maxLossPrice.toFixed(2)}
            </div>
          )}
        </div>

        {/* Breakeven */}
        <div className="rounded-lg border border-border/50 bg-muted/30 p-4">
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Target className="h-3 w-3 text-terminal-orange" />
            Breakeven
          </div>
          <div className="mt-1">
            {analysis.breakevens.length > 0 ? (
              <div className="space-y-1">
                {analysis.breakevens.map((be, i) => (
                  <div key={i} className="font-mono">
                    <span className="text-lg font-bold">${be.price.toFixed(2)}</span>
                    {be.btcPrice && (
                      <span className="ml-2 text-xs text-muted-foreground">
                        BTC@${be.btcPrice.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <span className="font-mono text-lg text-muted-foreground">N/A</span>
            )}
          </div>
        </div>
      </div>

      {/* Current P&L */}
      <div className="rounded-lg border border-border/50 bg-muted/30 p-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs text-muted-foreground">
              Current P&L (at ${underlyingPrice.toFixed(2)})
            </div>
            <div className="mt-1 flex items-baseline gap-2">
              <span
                className={`font-mono text-2xl font-bold ${
                  analysis.currentPnl > 0
                    ? "text-green-500"
                    : analysis.currentPnl < 0
                      ? "text-red-500"
                      : ""
                }`}
              >
                {formatPnL(analysis.currentPnl)}
              </span>
              <span
                className={`text-sm ${
                  analysis.currentPnlPercent > 0
                    ? "text-green-500"
                    : analysis.currentPnlPercent < 0
                      ? "text-red-500"
                      : "text-muted-foreground"
                }`}
              >
                ({formatPercent(analysis.currentPnlPercent)})
              </span>
            </div>
          </div>

          <div className="text-right">
            <div className="text-xs text-muted-foreground">Risk/Reward</div>
            <div className="mt-1 font-mono text-lg">
              {formatRiskReward(analysis.maxProfit, analysis.maxLoss)}
            </div>
          </div>

          <div className="text-right">
            <div className="text-xs text-muted-foreground">Days to Expiry</div>
            <div className="mt-1 font-mono text-lg">{analysis.daysToExpiry}</div>
          </div>
        </div>
      </div>

      {/* P&L at Target Prices */}
      {analysis.targetPnls.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-sm font-medium">P&L at Expiration</h4>
          <div className="rounded-md border">
            <Table className="text-xs">
              <TableHeader>
                <TableRow>
                  <TableHead>Price</TableHead>
                  <TableHead>BTC Equiv</TableHead>
                  <TableHead className="text-right">P&L</TableHead>
                  <TableHead className="text-right">Return</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {analysis.targetPnls.map((point, i) => {
                  const isCurrentPrice =
                    Math.abs(point.price - underlyingPrice) < 0.1
                  return (
                    <TableRow
                      key={i}
                      className={isCurrentPrice ? "bg-terminal-orange/10" : ""}
                    >
                      <TableCell className="font-mono">
                        <div className="flex items-center gap-2">
                          ${point.price.toFixed(2)}
                          {isCurrentPrice && (
                            <Badge
                              variant="outline"
                              className="text-[9px] text-terminal-orange"
                            >
                              Current
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-muted-foreground">
                        {point.btcPrice
                          ? `$${point.btcPrice.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
                          : "-"}
                      </TableCell>
                      <TableCell
                        className={`text-right font-mono font-medium ${
                          point.pnl > 0
                            ? "text-green-500"
                            : point.pnl < 0
                              ? "text-red-500"
                              : ""
                        }`}
                      >
                        {formatPnL(point.pnl)}
                      </TableCell>
                      <TableCell
                        className={`text-right font-mono ${
                          point.pnlPercent > 0
                            ? "text-green-500"
                            : point.pnlPercent < 0
                              ? "text-red-500"
                              : ""
                        }`}
                      >
                        {formatPercent(point.pnlPercent)}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* Greeks Summary */}
      <div className="flex flex-wrap gap-6 rounded-lg border border-border/50 bg-muted/30 p-4">
        <div>
          <div className="text-xs text-muted-foreground">Delta</div>
          <div className="font-mono text-lg">{analysis.totalDelta.toFixed(2)}</div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground">Gamma</div>
          <div className="font-mono text-lg">{analysis.totalGamma.toFixed(4)}</div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground">Theta</div>
          <div className="font-mono text-lg text-red-500">
            ${analysis.theta.toFixed(2)}/day
          </div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground">Vega</div>
          <div className="font-mono text-lg">{analysis.totalVega.toFixed(2)}</div>
        </div>
      </div>
    </div>
  )
}
