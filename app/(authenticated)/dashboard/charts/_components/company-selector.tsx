"use client"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select"
import { useRouter, useSearchParams } from "next/navigation"
import { useCallback, useEffect, useState } from "react"

interface Company {
  id: string
  ticker: string
  name: string
}

interface CompanySelectorProps {
  companies: Company[]
  currentTicker: string | null
}

export function CompanySelector({ companies, currentTicker }: CompanySelectorProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const handleCompanyChange = useCallback(
    (ticker: string) => {
      const params = new URLSearchParams(searchParams.toString())
      if (ticker === "all") {
        params.delete("company")
      } else {
        params.set("company", ticker)
      }
      router.push(`?${params.toString()}`, { scroll: false })
    },
    [router, searchParams]
  )

  // Render a placeholder during SSR to avoid hydration mismatch with Radix IDs
  if (!mounted) {
    return (
      <div className="flex h-9 w-[200px] items-center justify-between rounded-md border border-border bg-transparent px-3 py-2 text-sm">
        <span className="text-muted-foreground">All Companies (Aggregate)</span>
      </div>
    )
  }

  return (
    <Select value={currentTicker || "all"} onValueChange={handleCompanyChange}>
      <SelectTrigger className="w-[200px]">
        <SelectValue placeholder="Select company" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All Companies (Aggregate)</SelectItem>
        {companies.map(company => (
          <SelectItem key={company.id} value={company.ticker}>
            {company.ticker} - {company.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
