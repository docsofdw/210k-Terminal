"use server"

import { db } from "@/db"
import {
  companies,
  type InsertCompany,
  type SelectCompany
} from "@/db/schema/companies"
import { fundPositions } from "@/db/schema/fund-positions"
import { eq, desc, and, isNotNull, inArray } from "drizzle-orm"
import { logAudit } from "./audit"

export async function getAllCompanies(): Promise<SelectCompany[]> {
  const allCompanies = await db.query.companies.findMany({
    where: eq(companies.isTracked, true),
    orderBy: [desc(companies.btcHoldings)]
  })

  // Sort by rank if available, otherwise by BTC holdings
  return allCompanies.sort((a, b) => {
    const rankA = a.rank ? Number(a.rank) : 9999
    const rankB = b.rank ? Number(b.rank) : 9999
    return rankA - rankB
  })
}

export async function getAllCompaniesAdmin(): Promise<SelectCompany[]> {
  const allCompanies = await db.query.companies.findMany({
    orderBy: [desc(companies.btcHoldings)]
  })

  return allCompanies
}

export async function getCompanyById(
  id: string
): Promise<SelectCompany | null> {
  const company = await db.query.companies.findFirst({
    where: eq(companies.id, id)
  })

  return company || null
}

export async function getCompanyByTicker(
  ticker: string
): Promise<SelectCompany | null> {
  const company = await db.query.companies.findFirst({
    where: eq(companies.ticker, ticker)
  })

  return company || null
}

export async function createCompany(
  data: InsertCompany
): Promise<{ isSuccess: boolean; data?: SelectCompany; error?: string }> {
  try {
    const [newCompany] = await db.insert(companies).values(data).returning()

    if (!newCompany) {
      return { isSuccess: false, error: "Failed to create company" }
    }

    // Log audit
    await logAudit({
      action: "create",
      entity: "company",
      entityId: newCompany.id,
      entityName: newCompany.name,
      changesAfter: newCompany as unknown as Record<string, unknown>,
      description: `Created company: ${newCompany.name} (${newCompany.ticker})`
    })

    return { isSuccess: true, data: newCompany }
  } catch (error) {
    console.error("Error creating company:", error)
    return {
      isSuccess: false,
      error: error instanceof Error ? error.message : "Unknown error"
    }
  }
}

export async function updateCompany(
  id: string,
  updates: Partial<InsertCompany>
): Promise<{ isSuccess: boolean; data?: SelectCompany; error?: string }> {
  try {
    // Get current state for audit
    const currentCompany = await getCompanyById(id)
    if (!currentCompany) {
      return { isSuccess: false, error: "Company not found" }
    }

    const [updatedCompany] = await db
      .update(companies)
      .set({
        ...updates,
        updatedAt: new Date()
      })
      .where(eq(companies.id, id))
      .returning()

    if (!updatedCompany) {
      return { isSuccess: false, error: "Failed to update company" }
    }

    // Log audit with before/after
    await logAudit({
      action: "update",
      entity: "company",
      entityId: updatedCompany.id,
      entityName: updatedCompany.name,
      changesBefore: currentCompany as unknown as Record<string, unknown>,
      changesAfter: updatedCompany as unknown as Record<string, unknown>,
      description: `Updated company: ${updatedCompany.name}`
    })

    return { isSuccess: true, data: updatedCompany }
  } catch (error) {
    console.error("Error updating company:", error)
    return {
      isSuccess: false,
      error: error instanceof Error ? error.message : "Unknown error"
    }
  }
}

export async function updateCompanyHoldings(
  id: string,
  btcHoldings: string,
  source?: string
): Promise<{ isSuccess: boolean; data?: SelectCompany; error?: string }> {
  const company = await getCompanyById(id)
  const result = await updateCompany(id, {
    btcHoldings,
    btcHoldingsDate: new Date(),
    btcHoldingsSource: source || "Manual update"
  })

  if (result.isSuccess && company) {
    // Additional specific audit for holdings change
    await logAudit({
      action: "update",
      entity: "holdings",
      entityId: id,
      entityName: company.name,
      changesBefore: { btcHoldings: company.btcHoldings },
      changesAfter: { btcHoldings },
      description: `Updated BTC holdings for ${company.name}: ${company.btcHoldings} → ${btcHoldings}`
    })
  }

  return result
}

export async function deleteCompany(
  id: string
): Promise<{ isSuccess: boolean; error?: string }> {
  try {
    // Get company for audit
    const company = await getCompanyById(id)

    await db.delete(companies).where(eq(companies.id, id))

    if (company) {
      await logAudit({
        action: "delete",
        entity: "company",
        entityId: id,
        entityName: company.name,
        changesBefore: company as unknown as Record<string, unknown>,
        description: `Deleted company: ${company.name} (${company.ticker})`
      })
    }

    return { isSuccess: true }
  } catch (error) {
    console.error("Error deleting company:", error)
    return {
      isSuccess: false,
      error: error instanceof Error ? error.message : "Unknown error"
    }
  }
}

export async function toggleCompanyTracking(
  id: string,
  isTracked: boolean
): Promise<{ isSuccess: boolean; data?: SelectCompany; error?: string }> {
  return updateCompany(id, { isTracked })
}

export async function getLastSyncTimestamp(): Promise<Date | null> {
  const [result] = await db
    .select({ lastSyncedAt: companies.lastSyncedAt })
    .from(companies)
    .where(and(
      eq(companies.isTracked, true),
      isNotNull(companies.lastSyncedAt)
    ))
    .orderBy(desc(companies.lastSyncedAt))
    .limit(1)

  return result?.lastSyncedAt || null
}

// Check data quality for sync health indicator
export async function getSyncHealthStatus(): Promise<{
  quality: "healthy" | "degraded" | "poor"
  companiesWithMissingData: number
  totalCompanies: number
  lastSynced: Date | null
}> {
  const allCompanies = await db.query.companies.findMany({
    where: eq(companies.isTracked, true)
  })

  // Critical fields that should have data
  const criticalFields = ["price", "marketCapUsd", "dilutedMNav", "enterpriseValueUsd", "btcNavUsd"] as const

  let companiesWithMissingData = 0

  for (const company of allCompanies) {
    const missingFields = criticalFields.filter(field => {
      const value = company[field]
      return value === null || value === undefined || value === ""
    })

    // If more than 2 critical fields are missing, count as incomplete
    if (missingFields.length > 2) {
      companiesWithMissingData++
    }
  }

  const missingRatio = allCompanies.length > 0 ? companiesWithMissingData / allCompanies.length : 0

  let quality: "healthy" | "degraded" | "poor" = "healthy"
  if (missingRatio > 0.3) {
    quality = "poor"
  } else if (missingRatio > 0.1) {
    quality = "degraded"
  }

  const lastSynced = await getLastSyncTimestamp()

  return {
    quality,
    companiesWithMissingData,
    totalCompanies: allCompanies.length,
    lastSynced
  }
}

// Get company IDs that are in the 210k portfolio (fund positions)
export async function getPortfolioCompanyIds(): Promise<string[]> {
  const positions = await db
    .select({ companyId: fundPositions.companyId })
    .from(fundPositions)
    .where(isNotNull(fundPositions.companyId))

  // Filter out nulls and return unique company IDs
  const companyIds = positions
    .map(p => p.companyId)
    .filter((id): id is string => id !== null)

  return [...new Set(companyIds)]
}
