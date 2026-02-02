"use client"

import { useState, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { SymbolSelector } from "./symbol-selector"
import { OptionsChainTable } from "./options-chain-table"
import { StrategyBuilder } from "./strategy-builder"
import { AnalysisPanel } from "./analysis-panel"
import { SavedStrategies } from "./saved-strategies"
import { StrategyTemplates, type StrategyLeg } from "./strategy-templates"
import { PnLChart } from "./pnl-chart"
import type {
  OptionContract,
  OptionsChain,
  OptionLeg,
  StrategyAnalysis,
  Action,
  Underlying
} from "@/types/derivatives"

interface DerivativesSimulatorProps {
  initialBtcPrice: number
}

export function DerivativesSimulator({
  initialBtcPrice
}: DerivativesSimulatorProps) {
  // State
  const [symbol, setSymbol] = useState<Underlying>("IBIT")
  const [expiration, setExpiration] = useState<string | null>(null)
  const [chain, setChain] = useState<OptionsChain | null>(null)
  const [legs, setLegs] = useState<OptionLeg[]>([])
  const [analysis, setAnalysis] = useState<StrategyAnalysis | null>(null)
  const [isLoadingChain, setIsLoadingChain] = useState(false)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [btcPrice] = useState(initialBtcPrice)

  // Fetch options chain when symbol or expiration changes
  const fetchChain = useCallback(
    async (sym: string, exp: string) => {
      setIsLoadingChain(true)
      try {
        const response = await fetch(
          `/api/options/chain/${sym}?expiration=${exp}`
        )
        if (response.ok) {
          const data = await response.json()
          setChain({
            symbol: data.symbol,
            underlyingPrice: data.underlyingPrice,
            expiration: data.expiration,
            expirationDate: new Date(data.expiration),
            daysToExpiry: data.daysToExpiry,
            calls: data.calls,
            puts: data.puts,
            updated: new Date()
          })
        } else {
          setChain(null)
        }
      } catch (error) {
        console.error("Error fetching options chain:", error)
        setChain(null)
      } finally {
        setIsLoadingChain(false)
      }
    },
    []
  )

  // Handle symbol change
  const handleSymbolChange = (newSymbol: Underlying) => {
    setSymbol(newSymbol)
    setExpiration(null)
    setChain(null)
    setLegs([])
    setAnalysis(null)
  }

  // Handle expiration change
  const handleExpirationChange = (newExpiration: string) => {
    setExpiration(newExpiration)
    setLegs([])
    setAnalysis(null)
    fetchChain(symbol, newExpiration)
  }

  // Add a leg to the strategy
  const handleAddLeg = (contract: OptionContract, action: Action) => {
    const mid = contract.mid ?? contract.last ?? 0
    const newLeg: OptionLeg = {
      id: `${contract.symbol}-${Date.now()}`,
      contract,
      action,
      quantity: 1,
      cost: action === "buy" ? mid * 100 : -mid * 100,
      btcEquivalent: chain
        ? (contract.strike / chain.underlyingPrice) * btcPrice
        : null
    }
    setLegs((prev) => [...prev, newLeg])
  }

  // Remove a leg from the strategy
  const handleRemoveLeg = (legId: string) => {
    setLegs((prev) => prev.filter((leg) => leg.id !== legId))
  }

  // Update a leg
  const handleUpdateLeg = (
    legId: string,
    updates: Partial<Pick<OptionLeg, "action" | "quantity">>
  ) => {
    setLegs((prev) =>
      prev.map((leg) => {
        if (leg.id !== legId) return leg
        const newAction = updates.action ?? leg.action
        const newQuantity = updates.quantity ?? leg.quantity
        const mid = leg.contract.mid ?? leg.contract.last ?? 0
        return {
          ...leg,
          action: newAction,
          quantity: newQuantity,
          cost: newAction === "buy" ? mid * newQuantity * 100 : -mid * newQuantity * 100
        }
      })
    )
  }

  // Analyze the strategy
  const analyzeStrategy = useCallback(async () => {
    if (legs.length === 0 || !chain) return

    setIsAnalyzing(true)
    try {
      const targetPrices = generateTargetPrices(
        chain.underlyingPrice,
        legs.map((l) => l.contract.strike)
      )

      const response = await fetch("/api/options/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          legs: legs.map((leg) => ({
            strike: leg.contract.strike,
            type: leg.contract.type,
            action: leg.action,
            quantity: leg.quantity,
            premium: leg.contract.mid ?? leg.contract.last ?? 0,
            iv: leg.contract.iv,
            delta: leg.contract.delta,
            gamma: leg.contract.gamma,
            theta: leg.contract.theta,
            vega: leg.contract.vega
          })),
          underlyingPrice: chain.underlyingPrice,
          btcPrice,
          riskFreeRate: 0.05,
          daysToExpiry: chain.daysToExpiry,
          targetPrices
        })
      })

      if (response.ok) {
        const data = await response.json()
        setAnalysis(data)
      }
    } catch (error) {
      console.error("Error analyzing strategy:", error)
    } finally {
      setIsAnalyzing(false)
    }
  }, [legs, chain, btcPrice])

  // Load a saved strategy
  const handleLoadStrategy = (strategyLegs: OptionLeg[]) => {
    setLegs(strategyLegs)
    setAnalysis(null)
  }

  // Apply a strategy template
  const handleApplyTemplate = (templateLegs: StrategyLeg[]) => {
    const newLegs: OptionLeg[] = templateLegs.map((tl, index) => {
      const mid = tl.contract.mid ?? tl.contract.last ?? 0
      return {
        id: `${tl.contract.symbol}-${Date.now()}-${index}`,
        contract: tl.contract,
        action: tl.action,
        quantity: tl.quantity,
        cost: tl.action === "buy" ? mid * tl.quantity * 100 : -mid * tl.quantity * 100,
        btcEquivalent: chain
          ? (tl.contract.strike / chain.underlyingPrice) * btcPrice
          : null
      }
    })
    setLegs(newLegs)
    setAnalysis(null)
  }

  return (
    <div className="space-y-6">
      {/* Symbol and Expiration Selection */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Select Underlying</CardTitle>
        </CardHeader>
        <CardContent>
          <SymbolSelector
            symbol={symbol}
            expiration={expiration}
            onSymbolChange={handleSymbolChange}
            onExpirationChange={handleExpirationChange}
            underlyingPrice={chain?.underlyingPrice ?? null}
            btcPrice={btcPrice}
          />
        </CardContent>
      </Card>

      {/* Main content area */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Options Chain Table */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Options Chain</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoadingChain ? (
                <div className="flex h-64 items-center justify-center text-muted-foreground">
                  Loading options chain...
                </div>
              ) : chain ? (
                <OptionsChainTable
                  chain={chain}
                  btcPrice={btcPrice}
                  onAddLeg={handleAddLeg}
                  selectedStrikes={legs.map((l) => l.contract.strike)}
                />
              ) : expiration ? (
                <div className="flex h-64 items-center justify-center text-muted-foreground">
                  No options data available
                </div>
              ) : (
                <div className="flex h-64 items-center justify-center text-muted-foreground">
                  Select an expiration date to view options
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Strategy Builder */}
        <div className="space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-base">Strategy Builder</CardTitle>
              <StrategyTemplates
                chain={chain}
                onApplyStrategy={handleApplyTemplate}
              />
            </CardHeader>
            <CardContent>
              <StrategyBuilder
                legs={legs}
                onRemoveLeg={handleRemoveLeg}
                onUpdateLeg={handleUpdateLeg}
                onAnalyze={analyzeStrategy}
                isAnalyzing={isAnalyzing}
              />
            </CardContent>
          </Card>

          {/* P&L Chart */}
          {legs.length > 0 && chain && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">P&L at Expiration</CardTitle>
              </CardHeader>
              <CardContent>
                <PnLChart
                  legs={legs}
                  underlyingPrice={chain.underlyingPrice}
                  btcPrice={btcPrice}
                />
              </CardContent>
            </Card>
          )}

          {/* Saved Strategies */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Saved Strategies</CardTitle>
            </CardHeader>
            <CardContent>
              <SavedStrategies
                currentLegs={legs}
                symbol={symbol}
                chain={chain}
                btcPrice={btcPrice}
                onLoadStrategy={handleLoadStrategy}
              />
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Analysis Panel */}
      {analysis && chain && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Strategy Analysis</CardTitle>
          </CardHeader>
          <CardContent>
            <AnalysisPanel
              analysis={analysis}
              underlyingPrice={chain.underlyingPrice}
              btcPrice={btcPrice}
            />
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// Helper function to generate target prices for P&L analysis
function generateTargetPrices(currentPrice: number, strikes: number[]): number[] {
  const allPrices = [currentPrice, ...strikes]
  const min = Math.min(...allPrices) * 0.7
  const max = Math.max(...allPrices) * 1.3

  const prices: number[] = []
  const step = (max - min) / 10

  for (let price = min; price <= max; price += step) {
    prices.push(Math.round(price * 100) / 100)
  }

  // Add current price and strikes if not already included
  for (const strike of strikes) {
    if (!prices.some((p) => Math.abs(p - strike) < 0.01)) {
      prices.push(strike)
    }
  }
  if (!prices.some((p) => Math.abs(p - currentPrice) < 0.01)) {
    prices.push(currentPrice)
  }

  return prices.sort((a, b) => a - b)
}
