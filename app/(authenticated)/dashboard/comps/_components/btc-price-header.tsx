"use client"

import { Card, CardContent } from "@/components/ui/card"
import { formatNumber } from "@/lib/calculations"
import { Bitcoin, TrendingDown, TrendingUp } from "lucide-react"

interface BtcPriceHeaderProps {
  price: number
  change24h?: number
  high24h?: number
  low24h?: number
}

export function BtcPriceHeader({
  price,
  change24h = 0,
  high24h,
  low24h
}: BtcPriceHeaderProps) {
  const isPositive = change24h >= 0

  return (
    <Card>
      <CardContent className="flex items-center justify-between p-4">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-orange-100 dark:bg-orange-900/20">
            <Bitcoin className="h-6 w-6 text-orange-500" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Bitcoin Price</p>
            <p className="text-2xl font-bold">
              {formatNumber(price, { style: "currency", currency: "USD" })}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div
            className={`flex items-center gap-1 ${isPositive ? "text-green-500" : "text-red-500"}`}
          >
            {isPositive ? (
              <TrendingUp className="h-4 w-4" />
            ) : (
              <TrendingDown className="h-4 w-4" />
            )}
            <span className="font-medium">
              {isPositive ? "+" : ""}
              {formatNumber(change24h, { decimals: 2 })}%
            </span>
            <span className="text-xs text-muted-foreground">24h</span>
          </div>

          {high24h && low24h && (
            <div className="flex gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">H: </span>
                <span className="font-mono text-green-500">
                  {formatNumber(high24h, { style: "currency", currency: "USD" })}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">L: </span>
                <span className="font-mono text-red-500">
                  {formatNumber(low24h, { style: "currency", currency: "USD" })}
                </span>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
