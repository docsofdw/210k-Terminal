"use client"

import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger
} from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import { format } from "date-fns"
import { CalendarIcon } from "lucide-react"
import { useRouter, useSearchParams } from "next/navigation"
import { useState } from "react"

interface DatePickerProps {
  selectedDate: Date | undefined
  availableDates: Date[]
}

export function DatePicker({ selectedDate, availableDates }: DatePickerProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [open, setOpen] = useState(false)

  // Convert available dates to a Set for quick lookup
  const availableDateStrings = new Set(
    availableDates.map(d => format(d, "yyyy-MM-dd"))
  )

  function handleSelect(date: Date | undefined) {
    if (!date) return

    const params = new URLSearchParams(searchParams.toString())
    params.set("date", format(date, "yyyy-MM-dd"))
    router.push(`/dashboard/history?${params.toString()}`)
    setOpen(false)
  }

  function isDateDisabled(date: Date) {
    const dateStr = format(date, "yyyy-MM-dd")
    return !availableDateStrings.has(dateStr)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "w-[240px] justify-start text-left font-normal",
            !selectedDate && "text-muted-foreground"
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {selectedDate ? (
            format(selectedDate, "PPP")
          ) : (
            <span>Select a date</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={handleSelect}
          disabled={isDateDisabled}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  )
}
