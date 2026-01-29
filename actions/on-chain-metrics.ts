"use server"

import {
  getFundingRates as fetchFundingRates,
  get200WMAHeatmap as fetch200WMAHeatmap,
  getFearAndGreed as fetchFearAndGreed,
  getPiCycleTop as fetchPiCycleTop,
  getBitcoinVolatility as fetchBitcoinVolatility,
  getMvrvZScore as fetchMvrvZScore,
  getNupl as fetchNupl,
  type OnChainMetricDataPoint
} from "@/lib/api/bitcoin-magazine-pro"

export async function getFundingRates(
  days: number = 90
): Promise<OnChainMetricDataPoint[]> {
  return fetchFundingRates(days)
}

export async function get200WMAHeatmap(
  days: number = 90
): Promise<OnChainMetricDataPoint[]> {
  return fetch200WMAHeatmap(days)
}

export async function getFearAndGreed(
  days: number = 90
): Promise<OnChainMetricDataPoint[]> {
  return fetchFearAndGreed(days)
}

export async function getPiCycleTop(
  days: number = 90
): Promise<OnChainMetricDataPoint[]> {
  return fetchPiCycleTop(days)
}

export async function getBitcoinVolatility(
  days: number = 90
): Promise<OnChainMetricDataPoint[]> {
  return fetchBitcoinVolatility(days)
}

export async function getMvrvZScore(
  days: number = 90
): Promise<OnChainMetricDataPoint[]> {
  return fetchMvrvZScore(days)
}

export async function getNupl(
  days: number = 90
): Promise<OnChainMetricDataPoint[]> {
  return fetchNupl(days)
}
