"use server"

import { db } from "@/db"
import { watchlist } from "@/db/schema/watchlist"
import { companies } from "@/db/schema/companies"
import { auth } from "@clerk/nextjs/server"
import { eq, and, desc } from "drizzle-orm"
import { revalidatePath } from "next/cache"

export async function getWatchlist() {
  const { userId } = await auth()

  if (!userId) {
    return []
  }

  const items = await db
    .select({
      watchlistItem: watchlist,
      company: companies
    })
    .from(watchlist)
    .innerJoin(companies, eq(watchlist.companyId, companies.id))
    .where(eq(watchlist.userId, userId))
    .orderBy(desc(watchlist.createdAt))

  return items
}

export async function addToWatchlist(
  companyId: string,
  notes?: string
): Promise<{ isSuccess: boolean; error?: string }> {
  try {
    const { userId } = await auth()

    if (!userId) {
      return { isSuccess: false, error: "Not authenticated" }
    }

    // Check if already in watchlist
    const existing = await db
      .select()
      .from(watchlist)
      .where(
        and(eq(watchlist.userId, userId), eq(watchlist.companyId, companyId))
      )
      .limit(1)

    if (existing.length > 0) {
      return { isSuccess: false, error: "Already in watchlist" }
    }

    await db.insert(watchlist).values({
      userId,
      companyId,
      notes: notes || null
    })

    revalidatePath("/dashboard/watchlist")
    return { isSuccess: true }
  } catch (error) {
    console.error("Error adding to watchlist:", error)
    return { isSuccess: false, error: "Failed to add to watchlist" }
  }
}

export async function removeFromWatchlist(
  watchlistId: string
): Promise<{ isSuccess: boolean; error?: string }> {
  try {
    const { userId } = await auth()

    if (!userId) {
      return { isSuccess: false, error: "Not authenticated" }
    }

    await db
      .delete(watchlist)
      .where(and(eq(watchlist.id, watchlistId), eq(watchlist.userId, userId)))

    revalidatePath("/dashboard/watchlist")
    return { isSuccess: true }
  } catch (error) {
    console.error("Error removing from watchlist:", error)
    return { isSuccess: false, error: "Failed to remove from watchlist" }
  }
}

export async function updateWatchlistNotes(
  watchlistId: string,
  notes: string
): Promise<{ isSuccess: boolean; error?: string }> {
  try {
    const { userId } = await auth()

    if (!userId) {
      return { isSuccess: false, error: "Not authenticated" }
    }

    await db
      .update(watchlist)
      .set({ notes })
      .where(and(eq(watchlist.id, watchlistId), eq(watchlist.userId, userId)))

    revalidatePath("/dashboard/watchlist")
    return { isSuccess: true }
  } catch (error) {
    console.error("Error updating watchlist notes:", error)
    return { isSuccess: false, error: "Failed to update notes" }
  }
}

export async function isInWatchlist(companyId: string): Promise<boolean> {
  const { userId } = await auth()

  if (!userId) {
    return false
  }

  const existing = await db
    .select()
    .from(watchlist)
    .where(
      and(eq(watchlist.userId, userId), eq(watchlist.companyId, companyId))
    )
    .limit(1)

  return existing.length > 0
}
