"use server"

import { db } from "@/db"
import {
  companies,
  type InsertCompany,
  type SelectCompany
} from "@/db/schema/companies"
import { eq, desc, asc } from "drizzle-orm"

export async function getAllCompanies(): Promise<SelectCompany[]> {
  const allCompanies = await db.query.companies.findMany({
    where: eq(companies.isTracked, true),
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
    const [updatedCompany] = await db
      .update(companies)
      .set({
        ...updates,
        updatedAt: new Date()
      })
      .where(eq(companies.id, id))
      .returning()

    if (!updatedCompany) {
      return { isSuccess: false, error: "Company not found" }
    }

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
  return updateCompany(id, {
    btcHoldings,
    btcHoldingsDate: new Date(),
    btcHoldingsSource: source || "Manual update"
  })
}

export async function deleteCompany(
  id: string
): Promise<{ isSuccess: boolean; error?: string }> {
  try {
    await db.delete(companies).where(eq(companies.id, id))
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
