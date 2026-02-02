"use client"

import { useState } from "react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Plus, TrendingUp, TrendingDown } from "lucide-react"
import type { OptionsChain, OptionContract, Action } from "@/types/derivatives"
import { strikeToEquivalentBtcPrice } from "@/lib/utils/btc-conversion"

interface OptionsChainTableProps {
  chain: OptionsChain
  btcPrice: number
  onAddLeg: (contract: OptionContract, action: Action) => void
  selectedStrikes: number[]
}

type ViewMode = "calls" | "puts" | "straddle"

export function OptionsChainTable({
  chain,
  btcPrice,
  onAddLeg,
  selectedStrikes
}: OptionsChainTableProps) {
  const [viewMode, setViewMode] = useState<ViewMode>("straddle")

  const isCallITM = (strike: number) => strike < chain.underlyingPrice
  const isPutITM = (strike: number) => strike > chain.underlyingPrice
  const isATM = (strike: number) => Math.abs(strike - chain.underlyingPrice) < (chain.underlyingPrice * 0.01)

  const isSelected = (strike: number) => selectedStrikes.includes(strike)

  // Get unique strikes from both calls and puts
  const strikes = [
    ...new Set([
      ...chain.calls.map((c) => c.strike),
      ...chain.puts.map((c) => c.strike)
    ])
  ].sort((a, b) => a - b)

  // Map contracts by strike for easy lookup
  const callsByStrike = new Map(chain.calls.map((c) => [c.strike, c]))
  const putsByStrike = new Map(chain.puts.map((c) => [c.strike, c]))

  const formatPrice = (value: number | null) => {
    if (value === null) return "-"
    return value.toFixed(2)
  }

  const formatDelta = (value: number | null) => {
    if (value === null) return "-"
    return value.toFixed(2)
  }

  const formatIV = (value: number | null) => {
    if (value === null) return "-"
    return `${(value * 100).toFixed(0)}%`
  }

  const formatVolume = (value: number) => {
    if (value >= 1000) return `${(value / 1000).toFixed(1)}K`
    return value.toString()
  }

  return (
    <div className="space-y-4">
      {/* View Mode Tabs */}
      <div className="flex items-center justify-between">
        <Tabs
          value={viewMode}
          onValueChange={(v) => setViewMode(v as ViewMode)}
        >
          <TabsList>
            <TabsTrigger value="straddle">Straddle</TabsTrigger>
            <TabsTrigger value="calls">Calls Only</TabsTrigger>
            <TabsTrigger value="puts">Puts Only</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="text-xs text-muted-foreground">
          {chain.daysToExpiry} days to expiry
        </div>
      </div>

      {/* Options Table */}
      <div className="max-h-[500px] overflow-auto rounded-md border">
        <Table className="text-xs">
          <TableHeader className="sticky top-0 bg-background">
            <TableRow>
              {(viewMode === "calls" || viewMode === "straddle") && (
                <>
                  <TableHead className="w-[50px]"></TableHead>
                  <TableHead className="text-right">Last</TableHead>
                  <TableHead className="text-right">IV</TableHead>
                  <TableHead className="text-right">Delta</TableHead>
                  <TableHead className="text-right">Vol</TableHead>
                </>
              )}
              <TableHead className="bg-muted/50 text-center font-bold">
                Strike
              </TableHead>
              <TableHead className="bg-muted/50 text-center text-[10px]">
                BTC Equiv
              </TableHead>
              {(viewMode === "puts" || viewMode === "straddle") && (
                <>
                  <TableHead className="text-right">Vol</TableHead>
                  <TableHead className="text-right">Delta</TableHead>
                  <TableHead className="text-right">IV</TableHead>
                  <TableHead className="text-right">Last</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {strikes.map((strike) => {
              const call = callsByStrike.get(strike)
              const put = putsByStrike.get(strike)
              const btcEquiv = strikeToEquivalentBtcPrice(
                strike,
                chain.underlyingPrice,
                btcPrice
              )
              const callItm = isCallITM(strike)
              const putItm = isPutITM(strike)
              const atm = isATM(strike)
              const rowSelected = isSelected(strike)

              return (
                <TableRow
                  key={strike}
                  className={`
                    ${atm ? "bg-terminal-orange/10 border-terminal-orange/30" : ""}
                    ${rowSelected ? "bg-blue-500/10" : ""}
                  `}
                >
                  {/* CALLS */}
                  {(viewMode === "calls" || viewMode === "straddle") && (
                    <>
                      <TableCell className={`p-1 ${callItm ? "bg-green-500/20" : ""}`}>
                        {call && (
                          <div className="flex gap-1">
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-6 w-6 text-green-500 hover:bg-green-500/10"
                              onClick={() => onAddLeg(call, "buy")}
                              title="Buy Call"
                            >
                              <TrendingUp className="h-3 w-3" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-6 w-6 text-red-500 hover:bg-red-500/10"
                              onClick={() => onAddLeg(call, "sell")}
                              title="Sell Call"
                            >
                              <TrendingDown className="h-3 w-3" />
                            </Button>
                          </div>
                        )}
                      </TableCell>
                      <TableCell
                        className={`text-right font-mono ${
                          callItm ? "bg-green-500/20 font-semibold" : ""
                        }`}
                      >
                        {call ? formatPrice(call.mid ?? call.last) : "-"}
                      </TableCell>
                      <TableCell className={`text-right font-mono text-muted-foreground ${callItm ? "bg-green-500/10" : ""}`}>
                        {call ? formatIV(call.iv) : "-"}
                      </TableCell>
                      <TableCell className={`text-right font-mono ${callItm ? "bg-green-500/10" : ""}`}>
                        {call ? formatDelta(call.delta) : "-"}
                      </TableCell>
                      <TableCell className={`text-right font-mono text-muted-foreground ${callItm ? "bg-green-500/10" : ""}`}>
                        {call ? formatVolume(call.volume) : "-"}
                      </TableCell>
                    </>
                  )}

                  {/* STRIKE */}
                  <TableCell className={`text-center font-mono font-bold ${atm ? "bg-terminal-orange/20" : "bg-muted/30"}`}>
                    <div className="flex items-center justify-center gap-1">
                      {atm ? (
                        <Badge
                          variant="outline"
                          className="px-1 py-0 text-[9px] border-terminal-orange/50 text-terminal-orange"
                        >
                          ATM
                        </Badge>
                      ) : callItm && !putItm ? (
                        <Badge
                          variant="outline"
                          className="px-1 py-0 text-[8px] border-green-500/30 text-green-500"
                        >
                          ITM
                        </Badge>
                      ) : putItm && !callItm ? (
                        <Badge
                          variant="outline"
                          className="px-1 py-0 text-[8px] border-red-500/30 text-red-500"
                        >
                          ITM
                        </Badge>
                      ) : null}
                      ${strike.toFixed(2)}
                    </div>
                  </TableCell>
                  <TableCell className={`text-center font-mono text-[10px] text-muted-foreground ${atm ? "bg-terminal-orange/20" : "bg-muted/30"}`}>
                    ${btcEquiv.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </TableCell>

                  {/* PUTS */}
                  {(viewMode === "puts" || viewMode === "straddle") && (
                    <>
                      <TableCell className={`text-right font-mono text-muted-foreground ${putItm ? "bg-red-500/10" : ""}`}>
                        {put ? formatVolume(put.volume) : "-"}
                      </TableCell>
                      <TableCell className={`text-right font-mono ${putItm ? "bg-red-500/10" : ""}`}>
                        {put ? formatDelta(put.delta) : "-"}
                      </TableCell>
                      <TableCell className={`text-right font-mono text-muted-foreground ${putItm ? "bg-red-500/10" : ""}`}>
                        {put ? formatIV(put.iv) : "-"}
                      </TableCell>
                      <TableCell
                        className={`text-right font-mono ${
                          putItm ? "bg-red-500/20 font-semibold" : ""
                        }`}
                      >
                        {put ? formatPrice(put.mid ?? put.last) : "-"}
                      </TableCell>
                      <TableCell className={`p-1 ${putItm ? "bg-red-500/20" : ""}`}>
                        {put && (
                          <div className="flex gap-1">
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-6 w-6 text-green-500 hover:bg-green-500/10"
                              onClick={() => onAddLeg(put, "buy")}
                              title="Buy Put"
                            >
                              <TrendingUp className="h-3 w-3" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-6 w-6 text-red-500 hover:bg-red-500/10"
                              onClick={() => onAddLeg(put, "sell")}
                              title="Sell Put"
                            >
                              <TrendingDown className="h-3 w-3" />
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    </>
                  )}
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-1">
          <div className="h-3 w-3 rounded bg-green-500/20"></div>
          <span>ITM Call</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="h-3 w-3 rounded bg-red-500/20"></div>
          <span>ITM Put</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="h-3 w-3 rounded bg-terminal-orange/20"></div>
          <span>ATM</span>
        </div>
        <div className="flex items-center gap-1">
          <TrendingUp className="h-3 w-3 text-green-500" />
          <span>Buy</span>
        </div>
        <div className="flex items-center gap-1">
          <TrendingDown className="h-3 w-3 text-red-500" />
          <span>Sell</span>
        </div>
      </div>
    </div>
  )
}
