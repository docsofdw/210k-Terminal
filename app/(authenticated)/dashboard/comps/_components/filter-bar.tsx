"use client"

import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select"
import { RefreshCw } from "lucide-react"
import { useState, useTransition } from "react"

interface FilterBarProps {
  onRefresh?: () => void
  lastUpdated?: Date
}

export function FilterBar({ onRefresh, lastUpdated }: FilterBarProps) {
  const [isPending, startTransition] = useTransition()
  const [sectorFilter, setSectorFilter] = useState<string>("all")
  const [countryFilter, setCountryFilter] = useState<string>("all")

  const handleRefresh = () => {
    if (onRefresh) {
      startTransition(() => {
        onRefresh()
      })
    }
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={sectorFilter} onValueChange={setSectorFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Sector" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Sectors</SelectItem>
            <SelectItem value="Bitcoin Mining">Bitcoin Mining</SelectItem>
            <SelectItem value="Software">Software</SelectItem>
            <SelectItem value="Fintech">Fintech</SelectItem>
            <SelectItem value="Crypto Exchange">Crypto Exchange</SelectItem>
            <SelectItem value="Investment">Investment</SelectItem>
            <SelectItem value="Other">Other</SelectItem>
          </SelectContent>
        </Select>

        <Select value={countryFilter} onValueChange={setCountryFilter}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Country" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Countries</SelectItem>
            <SelectItem value="USA">USA</SelectItem>
            <SelectItem value="Canada">Canada</SelectItem>
            <SelectItem value="Japan">Japan</SelectItem>
            <SelectItem value="Singapore">Singapore</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center gap-4">
        {lastUpdated && (
          <span className="text-xs text-muted-foreground">
            Last updated: {lastUpdated.toLocaleTimeString()}
          </span>
        )}
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={isPending}
        >
          <RefreshCw
            className={`mr-2 h-4 w-4 ${isPending ? "animate-spin" : ""}`}
          />
          Refresh
        </Button>
      </div>
    </div>
  )
}
