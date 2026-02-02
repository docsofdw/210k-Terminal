"use client"

import { useState, useEffect, useCallback, useMemo, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select"
import { AlertCircle, RefreshCw } from "lucide-react"
import { toast } from "sonner"

import { AccountSummary, GreeksSummary } from "./account-summary"
import { PositionsTable } from "./positions-table"
import { UnifiedBuilder } from "./unified-builder"

import { getClearStreetDashboardData } from "@/actions/clear-street"
import { analyzeStrategy, type AnalyzeStrategyParams } from "@/lib/services/strategy-analyzer"
import { usdToBtc, strikeToEquivalentBtcPrice } from "@/lib/utils/btc-conversion"

import type {
  ClearStreetPositionsResponse,
  ClearStreetPnlResponse,
  EnrichedPosition
} from "@/types/clear-street"
import type {
  OptionsChain,
  OptionContract,
  OptionLeg,
  UnifiedLeg,
  StrategyAnalysis,
  Action,
  PnLViewMode,
  Underlying
} from "@/types/derivatives"
import { SUPPORTED_UNDERLYINGS } from "@/types/derivatives"

interface DerivativesUnifiedProps {
  initialBtcPrice: number
  initialPositions: ClearStreetPositionsResponse | null
  initialPnl: ClearStreetPnlResponse | null
  initialError?: string
}

// Auto-refresh interval (5 minutes)
const AUTO_REFRESH_INTERVAL = 5 * 60 * 1000

export function DerivativesUnified({
  initialBtcPrice,
  initialPositions,
  initialPnl,
  initialError
}: DerivativesUnifiedProps) {
  // Data state
  const [positions, setPositions] = useState<ClearStreetPositionsResponse | null>(
    initialPositions
  )
  const [pnl, setPnl] = useState<ClearStreetPnlResponse | null>(initialPnl)
  const [btcPrice] = useState(initialBtcPrice)
  const [error, setError] = useState<string | undefined>(initialError)
  const [isLoading, setIsLoading] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date())

  // Strategy builder state
  const [realLegs, setRealLegs] = useState<UnifiedLeg[]>([])
  const [simulatedLegs, setSimulatedLegs] = useState<UnifiedLeg[]>([])

  // Options chain state (for adding simulated legs)
  const [selectedSymbol, setSelectedSymbol] = useState<Underlying>("MSTR")
  const hasAutoSelectedSymbol = useRef(false)

  // Auto-select underlying based on positions (runs once on mount)
  useEffect(() => {
    if (hasAutoSelectedSymbol.current) return
    if (!initialPositions?.positions?.length) return

    // Count underlyings in positions
    const counts = initialPositions.positions.reduce((acc, pos) => {
      const underlying = pos.underlying || "MSTR"
      acc[underlying] = (acc[underlying] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    // Find most common
    const mostCommon = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]

    // Validate it's a supported underlying
    const supported = SUPPORTED_UNDERLYINGS.find(u => u.symbol === mostCommon?.[0])
    if (supported) {
      setSelectedSymbol(supported.symbol as Underlying)
    }

    hasAutoSelectedSymbol.current = true
  }, [initialPositions])
  const [selectedExpiration, setSelectedExpiration] = useState<string>("")
  const [expirations, setExpirations] = useState<string[]>([])
  const [optionsChain, setOptionsChain] = useState<OptionsChain | null>(null)
  const [underlyingPrice, setUnderlyingPrice] = useState<number>(0)
  const [isLoadingChain, setIsLoadingChain] = useState(false)

  // Analysis state
  const [analysis, setAnalysis] = useState<StrategyAnalysis | null>(null)
  const [viewMode, setViewMode] = useState<PnLViewMode>("combined")

  // Fetch expirations when symbol changes
  useEffect(() => {
    async function fetchExpirations() {
      try {
        const response = await fetch(`/api/options/expirations/${selectedSymbol}`)
        if (response.ok) {
          const data = await response.json()
          setExpirations(data.expirations || [])
          setSelectedExpiration("")
          setOptionsChain(null)
        }
      } catch (error) {
        console.error("Error fetching expirations:", error)
        setExpirations([])
      }
    }
    fetchExpirations()
  }, [selectedSymbol])

  // Fetch options chain when expiration changes
  useEffect(() => {
    if (!selectedExpiration) {
      setOptionsChain(null)
      return
    }

    async function fetchChain() {
      setIsLoadingChain(true)
      try {
        const response = await fetch(
          `/api/options/chain/${selectedSymbol}?expiration=${selectedExpiration}`
        )
        if (response.ok) {
          const data = await response.json()
          setOptionsChain(data)
          setUnderlyingPrice(data.underlyingPrice || 0)
        }
      } catch (error) {
        console.error("Error fetching options chain:", error)
        setOptionsChain(null)
      } finally {
        setIsLoadingChain(false)
      }
    }
    fetchChain()
  }, [selectedSymbol, selectedExpiration])

  // Refresh data from Clear Street
  const refreshData = useCallback(async () => {
    setIsLoading(true)
    try {
      const result = await getClearStreetDashboardData()

      if (result.isSuccess && result.data) {
        setPositions(result.data.positions)
        setPnl(result.data.pnl)
        setError(undefined)
        setLastUpdated(new Date())
        toast.success("Data refreshed")
      } else {
        setError(result.error)
        toast.error(result.error || "Failed to refresh data")
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to refresh"
      setError(message)
      toast.error(message)
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Auto-refresh every 5 minutes
  useEffect(() => {
    const interval = setInterval(refreshData, AUTO_REFRESH_INTERVAL)
    return () => clearInterval(interval)
  }, [refreshData])

  // Add a real position to the builder
  const addRealLeg = useCallback(
    (position: EnrichedPosition) => {
      // Check if already added
      if (realLegs.some((leg) => leg.clearStreetSymbol === position.clearStreetSymbol)) {
        toast.error("Position already in builder")
        return
      }

      const contract: OptionContract = {
        symbol: position.clearStreetSymbol,
        underlying: position.underlying,
        expiration: position.expiration || "",
        strike: position.strike || 0,
        type: position.optionType || "call",
        bid: position.bid,
        ask: position.ask,
        last: position.currentPrice,
        mid: position.currentPrice,
        volume: 0,
        openInterest: 0,
        iv: position.iv,
        delta: position.delta,
        gamma: position.gamma,
        theta: position.theta,
        vega: position.vega,
        updated: position.enrichedAt
      }

      const isLong = position.quantity > 0
      const quantity = Math.abs(position.quantity)
      const action: Action = isLong ? "buy" : "sell"
      const cost = position.costBasis

      const leg: UnifiedLeg = {
        id: `real-${position.clearStreetSymbol}`,
        contract,
        action,
        quantity,
        cost,
        btcEquivalent: strikeToEquivalentBtcPrice(
          position.strike || 0,
          underlyingPrice || 1,
          btcPrice
        ),
        source: "real",
        clearStreetSymbol: position.clearStreetSymbol,
        averageCost: position.averageCost,
        unrealizedPnl: position.unrealizedPnl,
        unrealizedPnlPercent: position.unrealizedPnlPercent,
        deltaExposure: position.deltaExposure,
        gammaExposure: position.gammaExposure,
        thetaExposure: position.thetaExposure,
        vegaExposure: position.vegaExposure
      }

      setRealLegs((prev) => [...prev, leg])
      toast.success(`Added ${position.underlying} position to builder`)
    },
    [realLegs, btcPrice, underlyingPrice]
  )

  // Add a simulated leg from options chain
  const addSimulatedLeg = useCallback(
    (contract: OptionContract, action: Action) => {
      const quantity = 1
      const premium = contract.mid || contract.last || 0
      const cost = action === "buy" ? premium * 100 : -premium * 100

      const leg: UnifiedLeg = {
        id: `sim-${Date.now()}-${contract.symbol}`,
        contract,
        action,
        quantity,
        cost,
        btcEquivalent: strikeToEquivalentBtcPrice(
          contract.strike,
          underlyingPrice || 1,
          btcPrice
        ),
        source: "simulated",
        deltaExposure:
          (contract.delta || 0) * quantity * 100 * (action === "buy" ? 1 : -1),
        gammaExposure:
          (contract.gamma || 0) * quantity * 100 * (action === "buy" ? 1 : -1),
        thetaExposure:
          (contract.theta || 0) * quantity * 100 * (action === "buy" ? 1 : -1),
        vegaExposure:
          (contract.vega || 0) * quantity * 100 * (action === "buy" ? 1 : -1)
      }

      setSimulatedLegs((prev) => [...prev, leg])
    },
    [btcPrice, underlyingPrice]
  )

  // Remove legs
  const removeRealLeg = useCallback((id: string) => {
    setRealLegs((prev) => prev.filter((leg) => leg.id !== id))
  }, [])

  const removeSimulatedLeg = useCallback((id: string) => {
    setSimulatedLegs((prev) => prev.filter((leg) => leg.id !== id))
  }, [])

  // Update simulated leg
  const updateSimulatedLeg = useCallback(
    (id: string, updates: Partial<UnifiedLeg>) => {
      setSimulatedLegs((prev) =>
        prev.map((leg) => {
          if (leg.id !== id) return leg

          const updatedLeg = { ...leg, ...updates }

          // Recalculate cost and exposures if quantity or action changed
          if (updates.quantity !== undefined || updates.action !== undefined) {
            const premium =
              updatedLeg.contract.mid || updatedLeg.contract.last || 0
            const multiplier = updatedLeg.action === "buy" ? 1 : -1

            updatedLeg.cost = premium * updatedLeg.quantity * 100 * multiplier
            updatedLeg.deltaExposure =
              (updatedLeg.contract.delta || 0) *
              updatedLeg.quantity *
              100 *
              multiplier
            updatedLeg.gammaExposure =
              (updatedLeg.contract.gamma || 0) *
              updatedLeg.quantity *
              100 *
              multiplier
            updatedLeg.thetaExposure =
              (updatedLeg.contract.theta || 0) *
              updatedLeg.quantity *
              100 *
              multiplier
            updatedLeg.vegaExposure =
              (updatedLeg.contract.vega || 0) *
              updatedLeg.quantity *
              100 *
              multiplier
          }

          return updatedLeg
        })
      )
    },
    []
  )

  const clearSimulated = useCallback(() => {
    setSimulatedLegs([])
  }, [])

  // Calculate totals
  const { totalCost, realCost, simulatedCost, totalDelta, totalGamma, totalTheta, totalVega } =
    useMemo(() => {
      const realCost = realLegs.reduce((sum, leg) => sum + leg.cost, 0)
      const simulatedCost = simulatedLegs.reduce((sum, leg) => sum + leg.cost, 0)
      const totalCost = realCost + simulatedCost

      const totalDelta =
        realLegs.reduce((sum, leg) => sum + (leg.deltaExposure || 0), 0) +
        simulatedLegs.reduce((sum, leg) => sum + (leg.deltaExposure || 0), 0)

      const totalGamma =
        realLegs.reduce((sum, leg) => sum + (leg.gammaExposure || 0), 0) +
        simulatedLegs.reduce((sum, leg) => sum + (leg.gammaExposure || 0), 0)

      const totalTheta =
        realLegs.reduce((sum, leg) => sum + (leg.thetaExposure || 0), 0) +
        simulatedLegs.reduce((sum, leg) => sum + (leg.thetaExposure || 0), 0)

      const totalVega =
        realLegs.reduce((sum, leg) => sum + (leg.vegaExposure || 0), 0) +
        simulatedLegs.reduce((sum, leg) => sum + (leg.vegaExposure || 0), 0)

      return {
        totalCost,
        realCost,
        simulatedCost,
        totalDelta,
        totalGamma,
        totalTheta,
        totalVega
      }
    }, [realLegs, simulatedLegs])

  // Run analysis when legs change
  useEffect(() => {
    const allLegs = [...realLegs, ...simulatedLegs]
    if (allLegs.length === 0 || underlyingPrice === 0) {
      setAnalysis(null)
      return
    }

    // Get legs based on view mode
    let legsToAnalyze: UnifiedLeg[]
    switch (viewMode) {
      case "real":
        legsToAnalyze = realLegs
        break
      case "simulated":
        legsToAnalyze = simulatedLegs
        break
      case "combined":
      default:
        legsToAnalyze = allLegs
    }

    if (legsToAnalyze.length === 0) {
      setAnalysis(null)
      return
    }

    // Convert to SimpleLeg format for analyzer
    const simpleLegs = legsToAnalyze.map((leg) => ({
      strike: leg.contract.strike,
      type: leg.contract.type,
      action: leg.action,
      quantity: leg.quantity,
      premium: leg.contract.mid || leg.contract.last || 0,
      iv: leg.contract.iv
    }))

    // Find the first expiration to use for DTE
    const firstExpiration = legsToAnalyze.find(
      (leg) => leg.contract.expiration
    )?.contract.expiration
    const daysToExpiry = firstExpiration
      ? Math.max(
          0,
          Math.ceil(
            (new Date(firstExpiration).getTime() - Date.now()) /
              (1000 * 60 * 60 * 24)
          )
        )
      : 30

    const params: AnalyzeStrategyParams = {
      legs: simpleLegs,
      underlyingPrice,
      btcPrice,
      daysToExpiry
    }

    const result = analyzeStrategy(params)
    setAnalysis(result)
  }, [realLegs, simulatedLegs, underlyingPrice, btcPrice, viewMode])

  // Position summary from Clear Street
  const positionSummary = positions?.summary || {
    totalPositions: 0,
    optionsCount: 0,
    equitiesCount: 0,
    totalMarketValue: 0,
    totalUnrealizedPnl: 0,
    totalDelta: 0,
    totalGamma: 0,
    totalTheta: 0,
    totalVega: 0
  }

  // Get selected strikes for highlighting in options chain
  const selectedStrikes = useMemo(() => {
    return [
      ...realLegs.map((leg) => leg.contract.strike),
      ...simulatedLegs.map((leg) => leg.contract.strike)
    ]
  }, [realLegs, simulatedLegs])

  // Detect mixed underlyings in the strategy builder
  const mixedUnderlyingsWarning = useMemo(() => {
    const allLegs = [...realLegs, ...simulatedLegs]
    if (allLegs.length < 2) return null

    const underlyings = new Set(allLegs.map((leg) => leg.contract.underlying))
    if (underlyings.size > 1) {
      return `Strategy contains multiple underlyings (${Array.from(underlyings).join(", ")}). Breakeven and P&L analysis may not be meaningful.`
    }
    return null
  }, [realLegs, simulatedLegs])

  return (
    <div className="space-y-6">
      {/* Error Banner */}
      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-500/50 bg-red-500/10 p-3 text-sm text-red-500">
          <AlertCircle className="h-4 w-4" />
          <span>{error}</span>
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto h-7"
            onClick={refreshData}
          >
            Retry
          </Button>
        </div>
      )}

      {/* Account Summary */}
      <AccountSummary
        pnl={pnl?.pnl || null}
        totalDelta={positionSummary.totalDelta}
        totalGamma={positionSummary.totalGamma}
        totalTheta={positionSummary.totalTheta}
        totalVega={positionSummary.totalVega}
        isLoading={isLoading}
      />

      {/* Refresh Button */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          Last updated: {lastUpdated.toLocaleTimeString()}
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={refreshData}
          disabled={isLoading}
        >
          <RefreshCw
            className={`mr-2 h-4 w-4 ${isLoading ? "animate-spin" : ""}`}
          />
          Refresh
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left Column: Positions + Builder */}
        <div className="space-y-6">
          {/* Clear Street Positions */}
          <PositionsTable
            positions={positions?.positions || []}
            onAddToBuilder={addRealLeg}
            isLoading={isLoading}
          />

          {/* Unified Strategy Builder */}
          <UnifiedBuilder
            realLegs={realLegs}
            simulatedLegs={simulatedLegs}
            onRemoveRealLeg={removeRealLeg}
            onRemoveSimulatedLeg={removeSimulatedLeg}
            onUpdateSimulatedLeg={updateSimulatedLeg}
            onClearSimulated={clearSimulated}
            totalCost={totalCost}
            realCost={realCost}
            simulatedCost={simulatedCost}
          />
        </div>

        {/* Right Column: Options Chain + Analysis */}
        <div className="space-y-6">
          {/* Symbol & Expiration Selection */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Add Simulated Legs</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap items-center gap-4">
                {/* Symbol Selector */}
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">
                    Underlying
                  </label>
                  <Select
                    value={selectedSymbol}
                    onValueChange={(v) => setSelectedSymbol(v as Underlying)}
                  >
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Select symbol" />
                    </SelectTrigger>
                    <SelectContent>
                      {SUPPORTED_UNDERLYINGS.map((u) => (
                        <SelectItem key={u.symbol} value={u.symbol}>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-medium">
                              {u.symbol}
                            </span>
                            <Badge
                              variant="outline"
                              className="ml-auto px-1 py-0 text-[10px]"
                            >
                              {u.type}
                            </Badge>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Expiration Selector */}
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">
                    Expiration
                  </label>
                  <Select
                    value={selectedExpiration}
                    onValueChange={setSelectedExpiration}
                    disabled={expirations.length === 0}
                  >
                    <SelectTrigger className="w-[160px]">
                      <SelectValue
                        placeholder={
                          expirations.length === 0
                            ? "No data"
                            : "Select expiration"
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {expirations.map((exp) => {
                        const date = new Date(exp)
                        const daysToExpiry = Math.max(
                          0,
                          Math.ceil(
                            (date.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
                          )
                        )
                        return (
                          <SelectItem key={exp} value={exp}>
                            <div className="flex items-center gap-2">
                              <span className="font-mono">
                                {date.toLocaleDateString("en-US", {
                                  month: "short",
                                  day: "numeric",
                                  year: "2-digit"
                                })}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {daysToExpiry}d
                              </span>
                            </div>
                          </SelectItem>
                        )
                      })}
                    </SelectContent>
                  </Select>
                </div>

                {/* Price Display */}
                {underlyingPrice > 0 && (
                  <div className="ml-auto text-right">
                    <div className="text-xs text-muted-foreground">Price</div>
                    <div className="font-mono font-bold">
                      ${underlyingPrice.toFixed(2)}
                    </div>
                  </div>
                )}
              </div>

              {/* Options Chain Table (simplified inline version) */}
              {isLoadingChain && (
                <div className="flex h-32 items-center justify-center">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-muted border-t-terminal-orange" />
                </div>
              )}

              {optionsChain && !isLoadingChain && (
                <div className="max-h-[400px] overflow-auto rounded-md border">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-background">
                      <tr className="border-b">
                        <th className="p-2 text-left">Call</th>
                        <th className="p-2 text-center">Strike</th>
                        <th className="p-2 text-right">Put</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        ...new Set([
                          ...optionsChain.calls.map((c) => c.strike),
                          ...optionsChain.puts.map((p) => p.strike)
                        ])
                      ]
                        .sort((a, b) => a - b)
                        .map((strike) => {
                          const call = optionsChain.calls.find(
                            (c) => c.strike === strike
                          )
                          const put = optionsChain.puts.find(
                            (p) => p.strike === strike
                          )
                          const isATM =
                            Math.abs(strike - optionsChain.underlyingPrice) <
                            optionsChain.underlyingPrice * 0.02
                          const isSelected = selectedStrikes.includes(strike)

                          return (
                            <tr
                              key={strike}
                              className={`border-b ${isSelected ? "bg-terminal-orange/10" : ""} ${isATM ? "bg-muted/50" : ""}`}
                            >
                              <td className="p-1">
                                {call && (
                                  <div className="flex items-center gap-1">
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-6 px-1 text-[10px] text-green-500 hover:bg-green-500/20"
                                      onClick={() => addSimulatedLeg(call, "buy")}
                                    >
                                      B
                                    </Button>
                                    <span className="w-12 text-right font-mono">
                                      {(call.mid || call.last || 0).toFixed(2)}
                                    </span>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-6 px-1 text-[10px] text-red-500 hover:bg-red-500/20"
                                      onClick={() => addSimulatedLeg(call, "sell")}
                                    >
                                      S
                                    </Button>
                                  </div>
                                )}
                              </td>
                              <td className="p-1 text-center">
                                <span
                                  className={`font-mono font-medium ${isATM ? "text-terminal-orange" : ""}`}
                                >
                                  ${strike}
                                </span>
                              </td>
                              <td className="p-1">
                                {put && (
                                  <div className="flex items-center justify-end gap-1">
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-6 px-1 text-[10px] text-green-500 hover:bg-green-500/20"
                                      onClick={() => addSimulatedLeg(put, "buy")}
                                    >
                                      B
                                    </Button>
                                    <span className="w-12 text-right font-mono">
                                      {(put.mid || put.last || 0).toFixed(2)}
                                    </span>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-6 px-1 text-[10px] text-red-500 hover:bg-red-500/20"
                                      onClick={() => addSimulatedLeg(put, "sell")}
                                    >
                                      S
                                    </Button>
                                  </div>
                                )}
                              </td>
                            </tr>
                          )
                        })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Greeks Summary for Builder */}
          {(realLegs.length > 0 || simulatedLegs.length > 0) && (
            <GreeksSummary
              totalDelta={totalDelta}
              totalGamma={totalGamma}
              totalTheta={totalTheta}
              totalVega={totalVega}
              realDelta={realLegs.reduce(
                (sum, leg) => sum + (leg.deltaExposure || 0),
                0
              )}
              simulatedDelta={simulatedLegs.reduce(
                (sum, leg) => sum + (leg.deltaExposure || 0),
                0
              )}
            />
          )}

          {/* Analysis Panel */}
          {analysis && (
            <>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">View:</span>
                <Tabs
                  value={viewMode}
                  onValueChange={(v) => setViewMode(v as PnLViewMode)}
                >
                  <TabsList className="h-8">
                    <TabsTrigger value="combined" className="h-6 text-xs">
                      Combined
                    </TabsTrigger>
                    <TabsTrigger value="real" className="h-6 text-xs">
                      Real
                    </TabsTrigger>
                    <TabsTrigger value="simulated" className="h-6 text-xs">
                      Simulated
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>

              {/* Analysis Summary */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Strategy Analysis</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Mixed Underlyings Warning */}
                  {mixedUnderlyingsWarning && (
                    <div className="flex items-center gap-2 rounded-lg border border-yellow-500/50 bg-yellow-500/10 p-2 text-xs text-yellow-500">
                      <AlertCircle className="h-4 w-4 flex-shrink-0" />
                      <span>{mixedUnderlyingsWarning}</span>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                    <div>
                      <p className="text-xs text-muted-foreground">Total Cost</p>
                      <p
                        className={`text-lg font-bold ${analysis.totalCost > 0 ? "text-red-500" : "text-green-500"}`}
                      >
                        {analysis.totalCost > 0 ? "-" : "+"}$
                        {Math.abs(analysis.totalCost).toLocaleString()}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Max Profit</p>
                      <p className="text-lg font-bold text-green-500">
                        {analysis.maxProfit === "unlimited"
                          ? "Unlimited"
                          : `$${analysis.maxProfit.toLocaleString()}`}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Max Loss</p>
                      <p className="text-lg font-bold text-red-500">
                        {analysis.maxLoss === "unlimited"
                          ? "Unlimited"
                          : `-$${Math.abs(analysis.maxLoss).toLocaleString()}`}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Breakeven</p>
                      <p className="text-lg font-bold">
                        {analysis.breakevens.length > 0
                          ? `$${analysis.breakevens[0].price.toFixed(2)}`
                          : "N/A"}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
