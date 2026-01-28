"use server"

import { db } from "@/db"
import {
  portfolioPositions,
  type InsertPortfolioPosition,
  type SelectPortfolioPosition
} from "@/db/schema/portfolio-positions"
import { companies } from "@/db/schema/companies"
import { eq, desc, and } from "drizzle-orm"
import { logAudit } from "./audit"
import { requireAuth } from "@/lib/auth/permissions"

// ============ POSITIONS ============

export async function getPositions(): Promise<SelectPortfolioPosition[]> {
  const user = await requireAuth()

  const positions = await db.query.portfolioPositions.findMany({
    where: eq(portfolioPositions.userId, user.userId),
    orderBy: [desc(portfolioPositions.updatedAt)]
  })

  return positions
}

export async function getPositionsWithCompanies() {
  const user = await requireAuth()

  const positions = await db
    .select({
      position: portfolioPositions,
      company: companies
    })
    .from(portfolioPositions)
    .innerJoin(companies, eq(portfolioPositions.companyId, companies.id))
    .where(eq(portfolioPositions.userId, user.userId))
    .orderBy(desc(portfolioPositions.updatedAt))

  return positions
}

export async function getPositionById(
  id: string
): Promise<SelectPortfolioPosition | null> {
  const user = await requireAuth()

  const position = await db.query.portfolioPositions.findFirst({
    where: and(
      eq(portfolioPositions.id, id),
      eq(portfolioPositions.userId, user.userId)
    )
  })

  return position || null
}

export async function createPosition(
  data: Omit<InsertPortfolioPosition, "userId">
): Promise<{ isSuccess: boolean; data?: SelectPortfolioPosition; error?: string }> {
  try {
    const user = await requireAuth()

    // Check if position already exists for this company
    const existing = await db.query.portfolioPositions.findFirst({
      where: and(
        eq(portfolioPositions.userId, user.userId),
        eq(portfolioPositions.companyId, data.companyId)
      )
    })

    if (existing) {
      return { isSuccess: false, error: "Position already exists for this company" }
    }

    const [newPosition] = await db
      .insert(portfolioPositions)
      .values({
        ...data,
        userId: user.userId
      })
      .returning()

    if (!newPosition) {
      return { isSuccess: false, error: "Failed to create position" }
    }

    await logAudit({
      action: "create",
      entity: "position",
      entityId: newPosition.id,
      changesAfter: newPosition as unknown as Record<string, unknown>,
      description: `Created portfolio position`
    })

    return { isSuccess: true, data: newPosition }
  } catch (error) {
    console.error("Error creating position:", error)
    return {
      isSuccess: false,
      error: error instanceof Error ? error.message : "Unknown error"
    }
  }
}

export async function updatePosition(
  id: string,
  updates: Partial<InsertPortfolioPosition>
): Promise<{ isSuccess: boolean; data?: SelectPortfolioPosition; error?: string }> {
  try {
    const user = await requireAuth()

    const currentPosition = await getPositionById(id)
    if (!currentPosition) {
      return { isSuccess: false, error: "Position not found" }
    }

    const [updatedPosition] = await db
      .update(portfolioPositions)
      .set({
        ...updates,
        updatedAt: new Date()
      })
      .where(
        and(
          eq(portfolioPositions.id, id),
          eq(portfolioPositions.userId, user.userId)
        )
      )
      .returning()

    if (!updatedPosition) {
      return { isSuccess: false, error: "Failed to update position" }
    }

    await logAudit({
      action: "update",
      entity: "position",
      entityId: updatedPosition.id,
      changesBefore: currentPosition as unknown as Record<string, unknown>,
      changesAfter: updatedPosition as unknown as Record<string, unknown>,
      description: `Updated portfolio position`
    })

    return { isSuccess: true, data: updatedPosition }
  } catch (error) {
    console.error("Error updating position:", error)
    return {
      isSuccess: false,
      error: error instanceof Error ? error.message : "Unknown error"
    }
  }
}

export async function deletePosition(
  id: string
): Promise<{ isSuccess: boolean; error?: string }> {
  try {
    const user = await requireAuth()

    const position = await getPositionById(id)
    if (!position) {
      return { isSuccess: false, error: "Position not found" }
    }

    await db
      .delete(portfolioPositions)
      .where(
        and(
          eq(portfolioPositions.id, id),
          eq(portfolioPositions.userId, user.userId)
        )
      )

    await logAudit({
      action: "delete",
      entity: "position",
      entityId: id,
      changesBefore: position as unknown as Record<string, unknown>,
      description: `Deleted portfolio position`
    })

    return { isSuccess: true }
  } catch (error) {
    console.error("Error deleting position:", error)
    return {
      isSuccess: false,
      error: error instanceof Error ? error.message : "Unknown error"
    }
  }
}
