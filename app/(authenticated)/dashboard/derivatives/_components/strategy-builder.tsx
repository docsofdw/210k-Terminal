"use client"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { StrategyLegRow } from "./strategy-leg-row"
import { Loader2, Calculator, Trash2 } from "lucide-react"
import type { OptionLeg, Action } from "@/types/derivatives"

interface StrategyBuilderProps {
  legs: OptionLeg[]
  onRemoveLeg: (legId: string) => void
  onUpdateLeg: (legId: string, updates: Partial<Pick<OptionLeg, "action" | "quantity">>) => void
  onAnalyze: () => void
  isAnalyzing: boolean
}

export function StrategyBuilder({
  legs,
  onRemoveLeg,
  onUpdateLeg,
  onAnalyze,
  isAnalyzing
}: StrategyBuilderProps) {
  // Calculate total cost
  const totalCost = legs.reduce((sum, leg) => sum + leg.cost, 0)
  const isDebit = totalCost > 0
  const isCredit = totalCost < 0

  // Clear all legs
  const handleClearAll = () => {
    legs.forEach((leg) => onRemoveLeg(leg.id))
  }

  if (legs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <div className="text-muted-foreground">
          <p className="text-sm">No legs added yet</p>
          <p className="mt-1 text-xs">
            Click the buy/sell buttons in the options chain to add legs
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Legs List */}
      <div className="space-y-2">
        {legs.map((leg) => (
          <StrategyLegRow
            key={leg.id}
            leg={leg}
            onRemove={() => onRemoveLeg(leg.id)}
            onUpdate={(updates) => onUpdateLeg(leg.id, updates)}
          />
        ))}
      </div>

      {/* Summary */}
      <div className="rounded-lg border border-border/50 bg-muted/30 p-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Net Premium</span>
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className={`text-[10px] ${
                isDebit
                  ? "border-red-500/30 text-red-500"
                  : isCredit
                    ? "border-green-500/30 text-green-500"
                    : "border-muted-foreground/30"
              }`}
            >
              {isDebit ? "Pay" : isCredit ? "Receive" : "Even"}
            </Badge>
            <span
              className={`font-mono text-lg font-bold ${
                isDebit
                  ? "text-red-400"
                  : isCredit
                    ? "text-green-400"
                    : "text-muted-foreground"
              }`}
            >
              ${Math.abs(totalCost).toFixed(2)}
            </span>
          </div>
        </div>

        <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
          <span>{legs.length} leg{legs.length !== 1 ? "s" : ""}</span>
          <span>
            {legs.reduce((sum, leg) => sum + leg.quantity, 0)} contract{legs.reduce((sum, leg) => sum + leg.quantity, 0) !== 1 ? "s" : ""}
          </span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <Button
          onClick={onAnalyze}
          disabled={isAnalyzing || legs.length === 0}
          className="flex-1"
        >
          {isAnalyzing ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Analyzing...
            </>
          ) : (
            <>
              <Calculator className="mr-2 h-4 w-4" />
              Analyze Strategy
            </>
          )}
        </Button>
        <Button variant="outline" size="icon" onClick={handleClearAll}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
