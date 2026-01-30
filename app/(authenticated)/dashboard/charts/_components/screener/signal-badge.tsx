"use client"

import { cn } from "@/lib/utils"

interface SignalBadgeProps {
  mNav: number | null
  deviation: number | null
  rank: number
}

type Signal = "attractive" | "expensive" | "fair"

function getSignal(mNav: number | null, deviation: number | null, rank: number): Signal {
  // Green "Attractive": mNAV < 1.0, OR deviation < -10%, OR (rank <= 3 AND deviation < 0)
  if (mNav !== null && mNav < 1.0) return "attractive"
  if (deviation !== null && deviation < -10) return "attractive"
  if (rank <= 3 && deviation !== null && deviation < 0) return "attractive"

  // Red "Expensive": mNAV > 2.0, OR deviation > +15%
  if (mNav !== null && mNav > 2.0) return "expensive"
  if (deviation !== null && deviation > 15) return "expensive"

  // Everything else is "Fair"
  return "fair"
}

export function SignalBadge({ mNav, deviation, rank }: SignalBadgeProps) {
  const signal = getSignal(mNav, deviation, rank)

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        signal === "attractive" && "bg-green-500/20 text-green-400",
        signal === "expensive" && "bg-red-500/20 text-red-400",
        signal === "fair" && "bg-yellow-500/20 text-yellow-400"
      )}
    >
      {signal === "attractive" && "Attractive"}
      {signal === "expensive" && "Expensive"}
      {signal === "fair" && "Fair"}
    </span>
  )
}
