"use server"

import { db } from "@/db"
import {
  savedStrategies,
  type InsertSavedStrategy,
  type SelectSavedStrategy
} from "@/db/schema/saved-strategies"
import { eq, desc, and } from "drizzle-orm"
import { logAudit } from "./audit"
import { requireAuth } from "@/lib/auth/permissions"
import type { SavedStrategyLeg } from "@/types/derivatives"

// ============ GET STRATEGIES ============

export async function getSavedStrategies(): Promise<SelectSavedStrategy[]> {
  const user = await requireAuth()

  const strategies = await db.query.savedStrategies.findMany({
    where: eq(savedStrategies.userId, user.userId),
    orderBy: [desc(savedStrategies.updatedAt)]
  })

  return strategies
}

export async function getSavedStrategyById(
  id: string
): Promise<SelectSavedStrategy | null> {
  const user = await requireAuth()

  const strategy = await db.query.savedStrategies.findFirst({
    where: and(
      eq(savedStrategies.id, id),
      eq(savedStrategies.userId, user.userId)
    )
  })

  return strategy || null
}

// ============ CREATE STRATEGY ============

export async function saveStrategy(data: {
  name: string
  underlying: string
  legs: SavedStrategyLeg[]
  notes?: string
}): Promise<{
  isSuccess: boolean
  data?: SelectSavedStrategy
  error?: string
}> {
  try {
    const user = await requireAuth()

    const [newStrategy] = await db
      .insert(savedStrategies)
      .values({
        userId: user.userId,
        name: data.name,
        underlying: data.underlying,
        legs: data.legs,
        notes: data.notes || null
      })
      .returning()

    if (!newStrategy) {
      return { isSuccess: false, error: "Failed to save strategy" }
    }

    await logAudit({
      action: "create",
      entity: "strategy",
      entityId: newStrategy.id,
      changesAfter: {
        name: newStrategy.name,
        underlying: newStrategy.underlying,
        legsCount: newStrategy.legs.length
      },
      description: `Saved derivatives strategy: ${newStrategy.name}`
    })

    return { isSuccess: true, data: newStrategy }
  } catch (error) {
    console.error("Error saving strategy:", error)
    return {
      isSuccess: false,
      error: error instanceof Error ? error.message : "Unknown error"
    }
  }
}

// ============ UPDATE STRATEGY ============

export async function updateStrategy(
  id: string,
  updates: Partial<{
    name: string
    underlying: string
    legs: SavedStrategyLeg[]
    notes: string | null
  }>
): Promise<{
  isSuccess: boolean
  data?: SelectSavedStrategy
  error?: string
}> {
  try {
    const user = await requireAuth()

    const currentStrategy = await getSavedStrategyById(id)
    if (!currentStrategy) {
      return { isSuccess: false, error: "Strategy not found" }
    }

    const [updatedStrategy] = await db
      .update(savedStrategies)
      .set({
        ...updates,
        updatedAt: new Date()
      })
      .where(
        and(
          eq(savedStrategies.id, id),
          eq(savedStrategies.userId, user.userId)
        )
      )
      .returning()

    if (!updatedStrategy) {
      return { isSuccess: false, error: "Failed to update strategy" }
    }

    await logAudit({
      action: "update",
      entity: "strategy",
      entityId: updatedStrategy.id,
      changesBefore: {
        name: currentStrategy.name,
        underlying: currentStrategy.underlying,
        legsCount: currentStrategy.legs.length
      },
      changesAfter: {
        name: updatedStrategy.name,
        underlying: updatedStrategy.underlying,
        legsCount: updatedStrategy.legs.length
      },
      description: `Updated derivatives strategy: ${updatedStrategy.name}`
    })

    return { isSuccess: true, data: updatedStrategy }
  } catch (error) {
    console.error("Error updating strategy:", error)
    return {
      isSuccess: false,
      error: error instanceof Error ? error.message : "Unknown error"
    }
  }
}

// ============ DELETE STRATEGY ============

export async function deleteStrategy(
  id: string
): Promise<{ isSuccess: boolean; error?: string }> {
  try {
    const user = await requireAuth()

    const strategy = await getSavedStrategyById(id)
    if (!strategy) {
      return { isSuccess: false, error: "Strategy not found" }
    }

    await db
      .delete(savedStrategies)
      .where(
        and(
          eq(savedStrategies.id, id),
          eq(savedStrategies.userId, user.userId)
        )
      )

    await logAudit({
      action: "delete",
      entity: "strategy",
      entityId: id,
      changesBefore: {
        name: strategy.name,
        underlying: strategy.underlying,
        legsCount: strategy.legs.length
      },
      description: `Deleted derivatives strategy: ${strategy.name}`
    })

    return { isSuccess: true }
  } catch (error) {
    console.error("Error deleting strategy:", error)
    return {
      isSuccess: false,
      error: error instanceof Error ? error.message : "Unknown error"
    }
  }
}
