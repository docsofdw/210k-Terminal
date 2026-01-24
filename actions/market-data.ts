"use server"

import { db } from "@/db"
import { btcPrices, type SelectBtcPrice } from "@/db/schema/btc-prices"
import { stockPrices, type SelectStockPrice } from "@/db/schema/stock-prices"
import { fxRates, type SelectFxRate } from "@/db/schema/fx-rates"
import { desc, eq, and, gte, lte } from "drizzle-orm"

// ============ BTC Price Functions ============

export async function getLatestBtcPrice(): Promise<SelectBtcPrice | null> {
  const price = await db.query.btcPrices.findFirst({
    orderBy: [desc(btcPrices.priceAt)]
  })

  return price || null
}

export async function getBtcPriceHistory(
  startDate: Date,
  endDate: Date
): Promise<SelectBtcPrice[]> {
  const prices = await db
    .select()
    .from(btcPrices)
    .where(and(gte(btcPrices.priceAt, startDate), lte(btcPrices.priceAt, endDate)))
    .orderBy(btcPrices.priceAt)

  return prices
}

export async function insertBtcPrice(data: {
  priceUsd: string
  high24h?: string
  low24h?: string
  volume24h?: string
  change24h?: string
  marketCap?: string
  priceAt: Date
}): Promise<{ isSuccess: boolean; error?: string }> {
  try {
    await db.insert(btcPrices).values(data)
    return { isSuccess: true }
  } catch (error) {
    console.error("Error inserting BTC price:", error)
    return {
      isSuccess: false,
      error: error instanceof Error ? error.message : "Unknown error"
    }
  }
}

// ============ Stock Price Functions ============

export async function getLatestStockPrice(
  companyId: string
): Promise<SelectStockPrice | null> {
  const price = await db.query.stockPrices.findFirst({
    where: eq(stockPrices.companyId, companyId),
    orderBy: [desc(stockPrices.priceAt)]
  })

  return price || null
}

export async function getLatestStockPrices(): Promise<
  Map<string, SelectStockPrice>
> {
  // Get all latest prices with a subquery approach
  // For simplicity, we'll get recent prices and deduplicate
  const recentPrices = await db
    .select()
    .from(stockPrices)
    .orderBy(desc(stockPrices.priceAt))
    .limit(500)

  const latestByCompany = new Map<string, SelectStockPrice>()

  for (const price of recentPrices) {
    if (!latestByCompany.has(price.companyId)) {
      latestByCompany.set(price.companyId, price)
    }
  }

  return latestByCompany
}

export async function getStockPriceHistory(
  companyId: string,
  startDate: Date,
  endDate: Date
): Promise<SelectStockPrice[]> {
  const prices = await db
    .select()
    .from(stockPrices)
    .where(
      and(
        eq(stockPrices.companyId, companyId),
        gte(stockPrices.priceAt, startDate),
        lte(stockPrices.priceAt, endDate)
      )
    )
    .orderBy(stockPrices.priceAt)

  return prices
}

export async function insertStockPrice(data: {
  companyId: string
  price: string
  open?: string
  high?: string
  low?: string
  close?: string
  volume?: string
  marketCapUsd?: string
  priceAt: Date
}): Promise<{ isSuccess: boolean; error?: string }> {
  try {
    await db.insert(stockPrices).values(data)
    return { isSuccess: true }
  } catch (error) {
    console.error("Error inserting stock price:", error)
    return {
      isSuccess: false,
      error: error instanceof Error ? error.message : "Unknown error"
    }
  }
}

// ============ FX Rate Functions ============

export async function getLatestFxRate(
  currency: string
): Promise<SelectFxRate | null> {
  const rate = await db.query.fxRates.findFirst({
    where: eq(fxRates.currency, currency),
    orderBy: [desc(fxRates.rateAt)]
  })

  return rate || null
}

export async function getLatestFxRates(): Promise<Map<string, SelectFxRate>> {
  const rates = await db
    .select()
    .from(fxRates)
    .orderBy(desc(fxRates.rateAt))
    .limit(100)

  const latestByCurrency = new Map<string, SelectFxRate>()

  for (const rate of rates) {
    if (!latestByCurrency.has(rate.currency)) {
      latestByCurrency.set(rate.currency, rate)
    }
  }

  return latestByCurrency
}

export async function insertFxRate(data: {
  currency: string
  rateToUsd: string
  rateFromUsd: string
  rateAt: Date
}): Promise<{ isSuccess: boolean; error?: string }> {
  try {
    await db.insert(fxRates).values(data)
    return { isSuccess: true }
  } catch (error) {
    console.error("Error inserting FX rate:", error)
    return {
      isSuccess: false,
      error: error instanceof Error ? error.message : "Unknown error"
    }
  }
}
