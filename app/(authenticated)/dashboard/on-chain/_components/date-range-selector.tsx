"use client"

import { Button } from "@/components/ui/button"
import { useRouter, useSearchParams } from "next/navigation"
import { useCallback } from "react"

const DATE_RANGES = [
  { label: "7D", days: 7 },
  { label: "30D", days: 30 },
  { label: "90D", days: 90 },
  { label: "1Y", days: 365 },
  { label: "4Y", days: 1460 }
] as const

interface DateRangeSelectorProps {
  currentDays: number
}

export function DateRangeSelector({ currentDays }: DateRangeSelectorProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const handleRangeChange = useCallback(
    (days: number) => {
      const params = new URLSearchParams(searchParams.toString())
      if (days === 90) {
        // 90 is the default, remove param
        params.delete("days")
      } else {
        params.set("days", days.toString())
      }
      router.push(`?${params.toString()}`, { scroll: false })
    },
    [router, searchParams]
  )

  return (
    <div className="flex items-center gap-1">
      {DATE_RANGES.map(range => {
        const isActive = range.days === currentDays
        return (
          <Button
            key={range.label}
            variant={isActive ? "default" : "outline"}
            size="sm"
            onClick={() => handleRangeChange(range.days)}
            className={`h-7 px-3 text-xs ${
              isActive
                ? "bg-terminal-orange text-black hover:bg-terminal-orange/90"
                : ""
            }`}
          >
            {range.label}
          </Button>
        )
      })}
    </div>
  )
}
