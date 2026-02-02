"use client"

import { useState, useEffect, useTransition } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from "@/components/ui/dialog"
import { Save, Loader2, FolderOpen, Trash2, MoreHorizontal } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu"
import {
  getSavedStrategies,
  saveStrategy,
  deleteStrategy
} from "@/actions/strategies"
import type {
  OptionLeg,
  OptionsChain,
  SavedStrategyLeg,
  Underlying
} from "@/types/derivatives"
import type { SelectSavedStrategy } from "@/db/schema/saved-strategies"

interface SavedStrategiesProps {
  currentLegs: OptionLeg[]
  symbol: Underlying
  chain: OptionsChain | null
  btcPrice: number
  onLoadStrategy: (legs: OptionLeg[]) => void
}

export function SavedStrategies({
  currentLegs,
  symbol,
  chain,
  btcPrice,
  onLoadStrategy
}: SavedStrategiesProps) {
  const [strategies, setStrategies] = useState<SelectSavedStrategy[]>([])
  const [isLoadingStrategies, setIsLoadingStrategies] = useState(true)
  const [isSaveDialogOpen, setIsSaveDialogOpen] = useState(false)
  const [strategyName, setStrategyName] = useState("")
  const [isPending, startTransition] = useTransition()

  // Load saved strategies on mount
  useEffect(() => {
    async function loadStrategies() {
      try {
        const data = await getSavedStrategies()
        setStrategies(data)
      } catch (error) {
        console.error("Error loading strategies:", error)
      } finally {
        setIsLoadingStrategies(false)
      }
    }
    loadStrategies()
  }, [])

  // Save current strategy
  const handleSave = () => {
    if (!strategyName.trim() || currentLegs.length === 0) return

    startTransition(async () => {
      const legs: SavedStrategyLeg[] = currentLegs.map((leg) => ({
        optionSymbol: leg.contract.symbol,
        underlying: leg.contract.underlying,
        expiration: leg.contract.expiration,
        strike: leg.contract.strike,
        type: leg.contract.type,
        action: leg.action,
        quantity: leg.quantity
      }))

      const result = await saveStrategy({
        name: strategyName.trim(),
        underlying: symbol,
        legs
      })

      if (result.isSuccess && result.data) {
        setStrategies((prev) => [result.data!, ...prev])
        setIsSaveDialogOpen(false)
        setStrategyName("")
      }
    })
  }

  // Delete a strategy
  const handleDelete = (id: string) => {
    startTransition(async () => {
      const result = await deleteStrategy(id)
      if (result.isSuccess) {
        setStrategies((prev) => prev.filter((s) => s.id !== id))
      }
    })
  }

  // Load a strategy - fetch fresh options data
  const handleLoad = async (strategy: SelectSavedStrategy) => {
    if (!chain) {
      alert("Please select an expiration date first")
      return
    }

    // Check if strategy matches current symbol
    if (strategy.underlying !== symbol) {
      alert(`This strategy is for ${strategy.underlying}. Please switch to that symbol first.`)
      return
    }

    // Map saved legs to current chain data
    const loadedLegs: OptionLeg[] = []

    for (const savedLeg of strategy.legs as SavedStrategyLeg[]) {
      // Find matching contract in current chain
      const contracts =
        savedLeg.type === "call" ? chain.calls : chain.puts
      const contract = contracts.find(
        (c) =>
          c.strike === savedLeg.strike &&
          c.expiration === savedLeg.expiration
      )

      if (contract) {
        const mid = contract.mid ?? contract.last ?? 0
        loadedLegs.push({
          id: `${contract.symbol}-${Date.now()}-${Math.random()}`,
          contract,
          action: savedLeg.action,
          quantity: savedLeg.quantity,
          cost:
            savedLeg.action === "buy"
              ? mid * savedLeg.quantity * 100
              : -mid * savedLeg.quantity * 100,
          btcEquivalent:
            (contract.strike / chain.underlyingPrice) * btcPrice
        })
      } else {
        console.warn(
          `Contract not found for ${savedLeg.type} ${savedLeg.strike} ${savedLeg.expiration}`
        )
      }
    }

    if (loadedLegs.length === 0) {
      alert("Could not load strategy - contracts may have expired or changed")
      return
    }

    onLoadStrategy(loadedLegs)
  }

  return (
    <div className="space-y-4">
      {/* Save Button */}
      <Dialog open={isSaveDialogOpen} onOpenChange={setIsSaveDialogOpen}>
        <DialogTrigger asChild>
          <Button
            variant="outline"
            className="w-full"
            disabled={currentLegs.length === 0}
          >
            <Save className="mr-2 h-4 w-4" />
            Save Current Strategy
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save Strategy</DialogTitle>
            <DialogDescription>
              Give your strategy a name to save it for later use.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Input
              placeholder="Strategy name (e.g., IBIT Bull Call Spread)"
              value={strategyName}
              onChange={(e) => setStrategyName(e.target.value)}
            />
            <div className="text-xs text-muted-foreground">
              {currentLegs.length} leg{currentLegs.length !== 1 ? "s" : ""} on{" "}
              {symbol}
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsSaveDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={!strategyName.trim() || isPending}
            >
              {isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Save
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Saved Strategies List */}
      {isLoadingStrategies ? (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      ) : strategies.length === 0 ? (
        <div className="py-4 text-center text-xs text-muted-foreground">
          No saved strategies yet
        </div>
      ) : (
        <div className="space-y-2">
          {strategies.slice(0, 5).map((strategy) => (
            <div
              key={strategy.id}
              className="flex items-center justify-between rounded-lg border border-border/50 bg-muted/30 p-2"
            >
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">
                  {strategy.name}
                </div>
                <div className="text-[10px] text-muted-foreground">
                  {strategy.underlying} · {(strategy.legs as SavedStrategyLeg[]).length} legs
                </div>
              </div>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => handleLoad(strategy)}>
                    <FolderOpen className="mr-2 h-4 w-4" />
                    Load
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="text-destructive"
                    onClick={() => handleDelete(strategy.id)}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ))}

          {strategies.length > 5 && (
            <div className="text-center text-xs text-muted-foreground">
              +{strategies.length - 5} more strategies
            </div>
          )}
        </div>
      )}
    </div>
  )
}
