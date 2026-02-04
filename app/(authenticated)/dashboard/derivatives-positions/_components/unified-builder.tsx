"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select"
import {
  Trash2,
  Plus,
  Minus,
  Building2,
  FlaskConical,
  TrendingUp,
  TrendingDown
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { UnifiedLeg, Action } from "@/types/derivatives"
import { formatExpiration, formatStrike } from "@/lib/utils/occ-parser"

interface UnifiedBuilderProps {
  realLegs: UnifiedLeg[]
  simulatedLegs: UnifiedLeg[]
  onRemoveRealLeg: (id: string) => void
  onRemoveSimulatedLeg: (id: string) => void
  onUpdateSimulatedLeg: (id: string, updates: Partial<UnifiedLeg>) => void
  onClearSimulated: () => void
  totalCost: number
  realCost: number
  simulatedCost: number
}

function formatCurrency(value: number): string {
  const absValue = Math.abs(value)
  const sign = value >= 0 ? "" : "-"
  if (absValue >= 1000000) {
    return `${sign}$${(absValue / 1000000).toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}M`
  }
  if (absValue >= 10000) {
    return `${sign}$${(absValue / 1000).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}K`
  }
  return `${sign}$${absValue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

interface LegRowProps {
  leg: UnifiedLeg
  isReal: boolean
  onRemove: () => void
  onUpdateQuantity?: (quantity: number) => void
  onUpdateAction?: (action: Action) => void
}

function LegRow({
  leg,
  isReal,
  onRemove,
  onUpdateQuantity,
  onUpdateAction
}: LegRowProps) {
  const isLong = leg.action === "buy"
  const isCall = leg.contract.type === "call"
  const displayQuantity = leg.action === "buy" ? leg.quantity : -leg.quantity

  return (
    <div
      className={cn(
        "flex items-center justify-between rounded-lg border p-3",
        isReal ? "border-blue-500/30 bg-blue-500/5" : "border-orange-500/30 bg-orange-500/5"
      )}
    >
      <div className="flex items-center gap-3">
        <Badge
          variant="outline"
          className={cn(
            "h-5 px-1.5 text-[10px]",
            isReal
              ? "border-blue-500 text-blue-500"
              : "border-orange-500 text-orange-500"
          )}
        >
          {isReal ? (
            <Building2 className="mr-1 h-3 w-3" />
          ) : (
            <FlaskConical className="mr-1 h-3 w-3" />
          )}
          {isReal ? "REAL" : "SIM"}
        </Badge>

        <div className="flex flex-col">
          <div className="flex items-center gap-1.5">
            <span className="font-medium">{leg.contract.underlying}</span>
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
            <span className="text-sm">
              ${formatStrike(leg.contract.strike)}
            </span>
          </div>
          <span className="text-xs text-muted-foreground">
            {formatExpiration(leg.contract.expiration)}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* Quantity controls */}
        <div className="flex items-center gap-1">
          {!isReal && onUpdateAction && (
            <Select
              value={leg.action}
              onValueChange={(value) => onUpdateAction(value as Action)}
            >
              <SelectTrigger className="h-7 w-16 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="buy">Buy</SelectItem>
                <SelectItem value="sell">Sell</SelectItem>
              </SelectContent>
            </Select>
          )}

          {!isReal && onUpdateQuantity ? (
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon"
                className="h-7 w-7"
                onClick={() =>
                  onUpdateQuantity(Math.max(1, leg.quantity - 1))
                }
                disabled={leg.quantity <= 1}
              >
                <Minus className="h-3 w-3" />
              </Button>
              <Input
                type="number"
                value={leg.quantity}
                onChange={(e) =>
                  onUpdateQuantity(Math.max(1, parseInt(e.target.value) || 1))
                }
                className="h-7 w-20 text-center text-sm font-mono [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                min={1}
              />
              <Button
                variant="outline"
                size="icon"
                className="h-7 w-7"
                onClick={() => onUpdateQuantity(leg.quantity + 1)}
              >
                <Plus className="h-3 w-3" />
              </Button>
            </div>
          ) : (
            <span
              className={cn(
                "w-20 text-right font-medium font-mono",
                displayQuantity > 0 ? "text-green-500" : "text-red-500"
              )}
            >
              {displayQuantity > 0 ? "+" : ""}
              {displayQuantity.toLocaleString()}
            </span>
          )}
        </div>

        {/* Cost */}
        <div className="w-20 text-right">
          <span
            className={cn(
              "text-sm font-medium",
              leg.cost < 0 ? "text-green-500" : "text-red-500"
            )}
          >
            {leg.cost < 0 ? "+" : ""}
            {formatCurrency(Math.abs(leg.cost))}
          </span>
          <p className="text-[10px] text-muted-foreground">
            {leg.cost < 0 ? "credit" : "debit"}
          </p>
        </div>

        {/* Delta exposure */}
        <div className="w-16 text-right">
          <span
            className={cn(
              "text-sm",
              (leg.deltaExposure ?? 0) > 0 && "text-green-500",
              (leg.deltaExposure ?? 0) < 0 && "text-red-500"
            )}
          >
            {(leg.deltaExposure ?? 0) > 0 ? "+" : ""}
            {(leg.deltaExposure ?? 0).toFixed(0)}
          </span>
          <p className="text-[10px] text-muted-foreground">delta</p>
        </div>

        {/* Remove button */}
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground hover:text-red-500"
          onClick={onRemove}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}

export function UnifiedBuilder({
  realLegs,
  simulatedLegs,
  onRemoveRealLeg,
  onRemoveSimulatedLeg,
  onUpdateSimulatedLeg,
  onClearSimulated,
  totalCost,
  realCost,
  simulatedCost
}: UnifiedBuilderProps) {
  const hasLegs = realLegs.length > 0 || simulatedLegs.length > 0
  const isDebit = totalCost > 0
  const realIsDebit = realCost > 0
  const simIsDebit = simulatedCost > 0

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Strategy Builder</CardTitle>
          <div className="flex items-center gap-2">
            {hasLegs && (
              <Badge
                variant={isDebit ? "destructive" : "default"}
                className={cn(
                  "text-xs",
                  !isDebit && "bg-green-500 hover:bg-green-600"
                )}
              >
                {isDebit ? "Net Debit" : "Net Credit"}:{" "}
                {formatCurrency(Math.abs(totalCost))}
              </Badge>
            )}
            {simulatedLegs.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={onClearSimulated}
              >
                Clear Simulated
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Real Positions Section */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Building2 className="h-4 w-4 text-blue-500" />
              Real Positions
              {realLegs.length > 0 && (
                <Badge variant="outline" className="ml-1 text-xs">
                  {realLegs.length}
                </Badge>
              )}
            </h4>
            {realLegs.length > 0 && (
              <span
                className={cn(
                  "text-xs",
                  realIsDebit ? "text-red-500" : "text-green-500"
                )}
              >
                {realIsDebit ? "Debit" : "Credit"}:{" "}
                {formatCurrency(Math.abs(realCost))}
              </span>
            )}
          </div>

          {realLegs.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              Click + on a position to add it here
            </p>
          ) : (
            <div className="space-y-2">
              {realLegs.map((leg) => (
                <LegRow
                  key={leg.id}
                  leg={leg}
                  isReal={true}
                  onRemove={() => onRemoveRealLeg(leg.id)}
                />
              ))}
            </div>
          )}
        </div>

        <Separator />

        {/* Simulated Positions Section */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <FlaskConical className="h-4 w-4 text-orange-500" />
              Simulated Adjustments
              {simulatedLegs.length > 0 && (
                <Badge variant="outline" className="ml-1 text-xs">
                  {simulatedLegs.length}
                </Badge>
              )}
            </h4>
            {simulatedLegs.length > 0 && (
              <span
                className={cn(
                  "text-xs",
                  simIsDebit ? "text-red-500" : "text-green-500"
                )}
              >
                {simIsDebit ? "Debit" : "Credit"}:{" "}
                {formatCurrency(Math.abs(simulatedCost))}
              </span>
            )}
          </div>

          {simulatedLegs.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              Add legs from the options chain below to simulate adjustments
            </p>
          ) : (
            <div className="space-y-2">
              {simulatedLegs.map((leg) => (
                <LegRow
                  key={leg.id}
                  leg={leg}
                  isReal={false}
                  onRemove={() => onRemoveSimulatedLeg(leg.id)}
                  onUpdateQuantity={(qty) =>
                    onUpdateSimulatedLeg(leg.id, { quantity: qty })
                  }
                  onUpdateAction={(action) =>
                    onUpdateSimulatedLeg(leg.id, { action })
                  }
                />
              ))}
            </div>
          )}
        </div>

        {/* Impact Summary */}
        {simulatedLegs.length > 0 && realLegs.length > 0 && (
          <>
            <Separator />
            <div className="rounded-lg bg-muted/50 p-3">
              <h4 className="mb-2 text-sm font-medium">
                Adjustment Impact
              </h4>
              <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
                <div>
                  <p className="text-xs text-muted-foreground">Cost Change</p>
                  <p
                    className={cn(
                      "font-medium",
                      simulatedCost < 0 ? "text-green-500" : "text-red-500"
                    )}
                  >
                    {simulatedCost < 0 ? "+" : "-"}
                    {formatCurrency(Math.abs(simulatedCost))}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Delta Change</p>
                  <p className="font-medium">
                    {simulatedLegs.reduce(
                      (sum, leg) => sum + (leg.deltaExposure ?? 0),
                      0
                    ) > 0
                      ? "+"
                      : ""}
                    {simulatedLegs
                      .reduce((sum, leg) => sum + (leg.deltaExposure ?? 0), 0)
                      .toFixed(0)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Theta Change</p>
                  <p className="font-medium">
                    {formatCurrency(
                      simulatedLegs.reduce(
                        (sum, leg) => sum + (leg.thetaExposure ?? 0),
                        0
                      )
                    )}
                    /day
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">New Total Cost</p>
                  <p
                    className={cn(
                      "font-medium",
                      totalCost < 0 ? "text-green-500" : "text-red-500"
                    )}
                  >
                    {formatCurrency(Math.abs(totalCost))}
                  </p>
                </div>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
