"use server"

import { db } from "@/db"
import { auditLog, type InsertAuditLog, type SelectAuditLog } from "@/db/schema/audit-log"
import { desc, eq, and, gte, lte } from "drizzle-orm"
import { auth } from "@clerk/nextjs/server"
import { getCustomerByUserId } from "./customers"

type AuditAction = "create" | "update" | "delete"
type AuditEntity = "company" | "holdings" | "user" | "alert" | "portfolio" | "position" | "transaction" | "strategy"

interface LogAuditParams {
  action: AuditAction
  entity: AuditEntity
  entityId?: string
  entityName?: string
  changesBefore?: Record<string, unknown>
  changesAfter?: Record<string, unknown>
  description?: string
}

export async function logAudit(params: LogAuditParams): Promise<{ isSuccess: boolean }> {
  try {
    const { userId } = await auth()

    if (!userId) {
      console.error("No user ID for audit log")
      return { isSuccess: false }
    }

    const customer = await getCustomerByUserId(userId)

    await db.insert(auditLog).values({
      userId,
      userEmail: customer?.email ?? null,
      action: params.action,
      entity: params.entity,
      entityId: params.entityId,
      entityName: params.entityName,
      changesBefore: params.changesBefore,
      changesAfter: params.changesAfter,
      description: params.description
    })

    return { isSuccess: true }
  } catch (error) {
    console.error("Error logging audit:", error)
    return { isSuccess: false }
  }
}

export async function getAuditLogs(options?: {
  entity?: AuditEntity
  entityId?: string
  userId?: string
  startDate?: Date
  endDate?: Date
  limit?: number
}): Promise<SelectAuditLog[]> {
  const { entity, entityId, userId, startDate, endDate, limit = 100 } = options || {}

  let query = db.select().from(auditLog)

  const conditions = []

  if (entity) {
    conditions.push(eq(auditLog.entity, entity))
  }

  if (entityId) {
    conditions.push(eq(auditLog.entityId, entityId))
  }

  if (userId) {
    conditions.push(eq(auditLog.userId, userId))
  }

  if (startDate) {
    conditions.push(gte(auditLog.createdAt, startDate))
  }

  if (endDate) {
    conditions.push(lte(auditLog.createdAt, endDate))
  }

  if (conditions.length > 0) {
    query = query.where(and(...conditions)) as typeof query
  }

  const logs = await query
    .orderBy(desc(auditLog.createdAt))
    .limit(limit)

  return logs
}

export async function getRecentAuditLogs(limit: number = 50): Promise<SelectAuditLog[]> {
  return getAuditLogs({ limit })
}

export async function getEntityAuditHistory(
  entity: AuditEntity,
  entityId: string
): Promise<SelectAuditLog[]> {
  return getAuditLogs({ entity, entityId, limit: 100 })
}
