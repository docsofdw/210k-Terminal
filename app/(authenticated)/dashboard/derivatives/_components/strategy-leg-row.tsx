"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select"
import { X } from "lucide-react"
import type { OptionLeg, Action } from "@/types/derivatives"

interface StrategyLegRowProps {
  leg: OptionLeg
  onRemove: () => void
  onUpdate: (updates: Partial<Pick<OptionLeg, "action" | "quantity">>) => void
}

export function StrategyLegRow({ leg, onRemove, onUpdate }: StrategyLegRowProps) {
  const { contract, action, quantity, cost } = leg
  const isBuy = action === "buy"
  const isCall = contract.type === "call"

  return (
    <div
      className={`rounded-lg border p-3 ${
        isBuy ? "border-green-500/30 bg-green-500/5" : "border-red-500/30 bg-red-500/5"
      }`}
    >
      {/* Top row: Strike, Type, Action, Qty */}
      <div className="flex items-center gap-3">
        {/* Strike + Type */}
        <div className="flex items-center gap-1.5 min-w-[80px]">
          <span className="font-mono text-base font-semibold">
            ${contract.strike.toLocaleString()}
          </span>
          <span
            className={`text-xs font-semibold px-1 py-0.5 rounded ${
              isCall ? "text-blue-400 bg-blue-400/10" : "text-purple-400 bg-purple-400/10"
            }`}
          >
            {isCall ? "C" : "P"}
          </span>
        </div>

        {/* Action Selector */}
        <Select value={action} onValueChange={(value) => onUpdate({ action: value as Action })}>
          <SelectTrigger className="w-[75px] h-7 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="buy">Buy</SelectItem>
            <SelectItem value="sell">Sell</SelectItem>
          </SelectContent>
        </Select>

        {/* Quantity */}
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground">×</span>
          <Input
            type="number"
            min={1}
            value={quantity}
            onChange={(e) => {
              const newQty = parseInt(e.target.value) || 1
              onUpdate({ quantity: Math.max(1, newQty) })
            }}
            className="w-[80px] h-7 text-sm text-center font-mono [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          />
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Cost */}
        <div
          className={`font-mono text-sm font-semibold min-w-[90px] text-right ${
            cost > 0 ? "text-red-400" : "text-green-400"
          }`}
        >
          {cost > 0 ? "-" : "+"}${Math.abs(cost).toLocaleString("en-US", { maximumFractionDigits: 0 })}
        </div>

        {/* Remove Button */}
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground hover:text-destructive"
          onClick={onRemove}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Bottom row: Expiration */}
      <div className="mt-1 text-[11px] text-muted-foreground">
        Exp: {contract.expiration}
      </div>
    </div>
  )
}
