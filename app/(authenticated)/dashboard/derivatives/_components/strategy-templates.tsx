"use client"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu"
import { ChevronDown, Zap } from "lucide-react"
import type { OptionsChain, OptionContract, Action } from "@/types/derivatives"

interface StrategyTemplatesProps {
  chain: OptionsChain | null
  onApplyStrategy: (legs: StrategyLeg[]) => void
}

export interface StrategyLeg {
  contract: OptionContract
  action: Action
  quantity: number
}

interface StrategyTemplate {
  name: string
  description: string
  category: "bullish" | "bearish" | "neutral" | "hedge"
  build: (chain: OptionsChain) => StrategyLeg[] | null
}

// Find ATM strike (closest to current price)
function findATMStrike(chain: OptionsChain): number {
  const allStrikes = [...new Set([
    ...chain.calls.map(c => c.strike),
    ...chain.puts.map(c => c.strike)
  ])].sort((a, b) => a - b)

  return allStrikes.reduce((closest, strike) =>
    Math.abs(strike - chain.underlyingPrice) < Math.abs(closest - chain.underlyingPrice)
      ? strike
      : closest
  )
}

// Find OTM call (above current price)
function findOTMCall(chain: OptionsChain, percentOTM: number = 0.05): OptionContract | null {
  const targetStrike = chain.underlyingPrice * (1 + percentOTM)
  const otmCalls = chain.calls.filter(c => c.strike > chain.underlyingPrice)
  if (otmCalls.length === 0) return null

  return otmCalls.reduce((closest, call) =>
    Math.abs(call.strike - targetStrike) < Math.abs(closest.strike - targetStrike)
      ? call
      : closest
  )
}

// Find OTM put (below current price)
function findOTMPut(chain: OptionsChain, percentOTM: number = 0.05): OptionContract | null {
  const targetStrike = chain.underlyingPrice * (1 - percentOTM)
  const otmPuts = chain.puts.filter(p => p.strike < chain.underlyingPrice)
  if (otmPuts.length === 0) return null

  return otmPuts.reduce((closest, put) =>
    Math.abs(put.strike - targetStrike) < Math.abs(closest.strike - targetStrike)
      ? put
      : closest
  )
}

// Strategy templates
const STRATEGY_TEMPLATES: StrategyTemplate[] = [
  // === BULLISH ===
  {
    name: "Long Call",
    description: "Buy a call option - unlimited upside, limited downside",
    category: "bullish",
    build: (chain) => {
      const call = findOTMCall(chain, 0.02)
      if (!call) return null
      return [{ contract: call, action: "buy", quantity: 1 }]
    }
  },
  {
    name: "Bull Call Spread",
    description: "Buy lower strike call, sell higher strike call",
    category: "bullish",
    build: (chain) => {
      const buyCall = findOTMCall(chain, 0.02)
      const sellCall = findOTMCall(chain, 0.07)
      if (!buyCall || !sellCall) return null
      return [
        { contract: buyCall, action: "buy", quantity: 1 },
        { contract: sellCall, action: "sell", quantity: 1 }
      ]
    }
  },
  {
    name: "Cash Secured Put",
    description: "Sell a put - collect premium, obligated to buy shares",
    category: "bullish",
    build: (chain) => {
      const put = findOTMPut(chain, 0.05)
      if (!put) return null
      return [{ contract: put, action: "sell", quantity: 1 }]
    }
  },

  // === BEARISH ===
  {
    name: "Long Put",
    description: "Buy a put option - profit from downside",
    category: "bearish",
    build: (chain) => {
      const put = findOTMPut(chain, 0.02)
      if (!put) return null
      return [{ contract: put, action: "buy", quantity: 1 }]
    }
  },
  {
    name: "Bear Put Spread",
    description: "Buy higher strike put, sell lower strike put",
    category: "bearish",
    build: (chain) => {
      const buyPut = findOTMPut(chain, 0.02)
      const sellPut = findOTMPut(chain, 0.07)
      if (!buyPut || !sellPut) return null
      return [
        { contract: buyPut, action: "buy", quantity: 1 },
        { contract: sellPut, action: "sell", quantity: 1 }
      ]
    }
  },

  // === NEUTRAL ===
  {
    name: "Long Straddle",
    description: "Buy ATM call + put - profit from big move either direction",
    category: "neutral",
    build: (chain) => {
      const atmStrike = findATMStrike(chain)
      const call = chain.calls.find(c => c.strike === atmStrike)
      const put = chain.puts.find(p => p.strike === atmStrike)
      if (!call || !put) return null
      return [
        { contract: call, action: "buy", quantity: 1 },
        { contract: put, action: "buy", quantity: 1 }
      ]
    }
  },
  {
    name: "Short Straddle",
    description: "Sell ATM call + put - profit from low volatility",
    category: "neutral",
    build: (chain) => {
      const atmStrike = findATMStrike(chain)
      const call = chain.calls.find(c => c.strike === atmStrike)
      const put = chain.puts.find(p => p.strike === atmStrike)
      if (!call || !put) return null
      return [
        { contract: call, action: "sell", quantity: 1 },
        { contract: put, action: "sell", quantity: 1 }
      ]
    }
  },
  {
    name: "Long Strangle",
    description: "Buy OTM call + put - cheaper than straddle, needs bigger move",
    category: "neutral",
    build: (chain) => {
      const call = findOTMCall(chain, 0.05)
      const put = findOTMPut(chain, 0.05)
      if (!call || !put) return null
      return [
        { contract: call, action: "buy", quantity: 1 },
        { contract: put, action: "buy", quantity: 1 }
      ]
    }
  },
  {
    name: "Short Strangle",
    description: "Sell OTM call + put - collect premium, profit from range-bound",
    category: "neutral",
    build: (chain) => {
      const call = findOTMCall(chain, 0.05)
      const put = findOTMPut(chain, 0.05)
      if (!call || !put) return null
      return [
        { contract: call, action: "sell", quantity: 1 },
        { contract: put, action: "sell", quantity: 1 }
      ]
    }
  },
  {
    name: "Iron Condor",
    description: "Sell strangle + buy wings - defined risk range play",
    category: "neutral",
    build: (chain) => {
      const sellCall = findOTMCall(chain, 0.05)
      const buyCall = findOTMCall(chain, 0.10)
      const sellPut = findOTMPut(chain, 0.05)
      const buyPut = findOTMPut(chain, 0.10)
      if (!sellCall || !buyCall || !sellPut || !buyPut) return null
      return [
        { contract: sellCall, action: "sell", quantity: 1 },
        { contract: buyCall, action: "buy", quantity: 1 },
        { contract: sellPut, action: "sell", quantity: 1 },
        { contract: buyPut, action: "buy", quantity: 1 }
      ]
    }
  },

  // === HEDGE ===
  {
    name: "Protective Put",
    description: "Buy put to protect long stock position",
    category: "hedge",
    build: (chain) => {
      const put = findOTMPut(chain, 0.05)
      if (!put) return null
      return [{ contract: put, action: "buy", quantity: 1 }]
    }
  },
  {
    name: "Collar",
    description: "Buy put + sell call - cap upside to protect downside",
    category: "hedge",
    build: (chain) => {
      const put = findOTMPut(chain, 0.05)
      const call = findOTMCall(chain, 0.05)
      if (!put || !call) return null
      return [
        { contract: put, action: "buy", quantity: 1 },
        { contract: call, action: "sell", quantity: 1 }
      ]
    }
  },
  {
    name: "Covered Call",
    description: "Sell call against long stock - generate income",
    category: "hedge",
    build: (chain) => {
      const call = findOTMCall(chain, 0.05)
      if (!call) return null
      return [{ contract: call, action: "sell", quantity: 1 }]
    }
  },
  {
    name: "Risk Reversal",
    description: "Sell put + buy call - synthetic long with premium",
    category: "hedge",
    build: (chain) => {
      const put = findOTMPut(chain, 0.05)
      const call = findOTMCall(chain, 0.05)
      if (!put || !call) return null
      return [
        { contract: put, action: "sell", quantity: 1 },
        { contract: call, action: "buy", quantity: 1 }
      ]
    }
  }
]

const CATEGORY_LABELS = {
  bullish: { label: "Bullish", color: "text-green-400" },
  bearish: { label: "Bearish", color: "text-red-400" },
  neutral: { label: "Neutral", color: "text-yellow-400" },
  hedge: { label: "Hedge", color: "text-blue-400" }
}

export function StrategyTemplates({ chain, onApplyStrategy }: StrategyTemplatesProps) {
  const handleSelectStrategy = (template: StrategyTemplate) => {
    if (!chain) return

    const legs = template.build(chain)
    if (legs && legs.length > 0) {
      onApplyStrategy(legs)
    }
  }

  const groupedStrategies = STRATEGY_TEMPLATES.reduce((acc, strategy) => {
    if (!acc[strategy.category]) acc[strategy.category] = []
    acc[strategy.category].push(strategy)
    return acc
  }, {} as Record<string, StrategyTemplate[]>)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" disabled={!chain} className="gap-2">
          <Zap className="h-4 w-4" />
          Strategies
          <ChevronDown className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[280px]">
        {(["bullish", "bearish", "neutral", "hedge"] as const).map((category) => (
          <div key={category}>
            <DropdownMenuLabel className={CATEGORY_LABELS[category].color}>
              {CATEGORY_LABELS[category].label}
            </DropdownMenuLabel>
            {groupedStrategies[category]?.map((strategy) => (
              <DropdownMenuItem
                key={strategy.name}
                onClick={() => handleSelectStrategy(strategy)}
                className="flex flex-col items-start py-2"
              >
                <span className="font-medium">{strategy.name}</span>
                <span className="text-[11px] text-muted-foreground">
                  {strategy.description}
                </span>
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
          </div>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
