"use client"

import { useEffect, useState } from "react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertCircle } from "lucide-react"
import { SUPPORTED_UNDERLYINGS, type Underlying } from "@/types/derivatives"
import { formatBtc } from "@/lib/utils/btc-conversion"

interface SymbolSelectorProps {
  symbol: Underlying
  expiration: string | null
  onSymbolChange: (symbol: Underlying) => void
  onExpirationChange: (expiration: string) => void
  underlyingPrice: number | null
  btcPrice: number
}

export function SymbolSelector({
  symbol,
  expiration,
  onSymbolChange,
  onExpirationChange,
  underlyingPrice,
  btcPrice
}: SymbolSelectorProps) {
  const [expirations, setExpirations] = useState<string[]>([])
  const [isLoadingExpirations, setIsLoadingExpirations] = useState(false)
  const [apiError, setApiError] = useState<string | null>(null)

  // Fetch expirations when symbol changes
  useEffect(() => {
    async function fetchExpirations() {
      setIsLoadingExpirations(true)
      setApiError(null)
      try {
        const response = await fetch(`/api/options/expirations/${symbol}`)
        if (response.ok) {
          const data = await response.json()
          setExpirations(data.expirations || [])
        } else {
          const errorData = await response.json().catch(() => ({}))
          setApiError(errorData.error || "Failed to load options data")
          setExpirations([])
        }
      } catch (error) {
        console.error("Error fetching expirations:", error)
        setApiError("Network error - unable to fetch options data")
        setExpirations([])
      } finally {
        setIsLoadingExpirations(false)
      }
    }

    fetchExpirations()
  }, [symbol])

  const selectedUnderlying = SUPPORTED_UNDERLYINGS.find(
    (u) => u.symbol === symbol
  )

  const btcPerShare =
    underlyingPrice && btcPrice > 0 ? underlyingPrice / btcPrice : null

  return (
    <div className="space-y-4">
      {/* API Error Alert */}
      {apiError && (
        <Alert variant="destructive" className="bg-destructive/10">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="text-xs">
            {apiError}
          </AlertDescription>
        </Alert>
      )}

      <div className="flex flex-wrap items-center gap-4">
        {/* Symbol Selector */}
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Underlying</label>
          <Select
            value={symbol}
            onValueChange={(value) => onSymbolChange(value as Underlying)}
          >
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Select underlying" />
            </SelectTrigger>
            <SelectContent>
              {SUPPORTED_UNDERLYINGS.map((u) => (
                <SelectItem key={u.symbol} value={u.symbol}>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-medium">{u.symbol}</span>
                    <span className="text-xs text-muted-foreground">
                      {u.name}
                    </span>
                    <Badge
                      variant="outline"
                      className="ml-auto text-[10px] px-1 py-0"
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
          <label className="text-xs text-muted-foreground">Expiration</label>
          <Select
            value={expiration || ""}
            onValueChange={onExpirationChange}
            disabled={isLoadingExpirations || expirations.length === 0}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue
                placeholder={
                  isLoadingExpirations
                    ? "Loading..."
                    : expirations.length === 0
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
      </div>

      {/* Price Display */}
      {selectedUnderlying && (
        <div className="flex flex-wrap items-center gap-6 rounded-lg border border-border/50 bg-muted/30 p-3">
          <div>
            <div className="text-xs text-muted-foreground">Symbol</div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-lg font-bold">
                {selectedUnderlying.symbol}
              </span>
              <Badge variant="outline" className="text-[10px]">
                {selectedUnderlying.type}
              </Badge>
            </div>
          </div>

          {underlyingPrice !== null && (
            <>
              <div>
                <div className="text-xs text-muted-foreground">Price</div>
                <div className="font-mono text-lg font-bold">
                  ${underlyingPrice.toFixed(2)}
                </div>
              </div>

              {btcPerShare !== null && (
                <div>
                  <div className="text-xs text-muted-foreground">
                    BTC per Share
                  </div>
                  <div className="font-mono text-lg">
                    {formatBtc(btcPerShare)}
                  </div>
                </div>
              )}
            </>
          )}

          <div className="ml-auto">
            <div className="text-xs text-muted-foreground">BTC Price</div>
            <div className="font-mono text-lg text-terminal-orange">
              ${btcPrice.toLocaleString()}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
