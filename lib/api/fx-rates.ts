const EXCHANGE_RATE_API_BASE = "https://api.exchangerate-api.com/v4/latest"

export interface FxRates {
  base: string
  rates: Record<string, number>
  timestamp: Date
}

// Supported currencies for treasury companies
export const SUPPORTED_CURRENCIES = [
  "USD", "CAD", "EUR", "GBP", "JPY", "HKD", "AUD",
  "BRL", "THB", "KRW"  // Brazil, Thailand, South Korea
] as const
export type SupportedCurrency = (typeof SUPPORTED_CURRENCIES)[number]

export async function getFxRates(base: string = "USD"): Promise<FxRates | null> {
  try {
    const response = await fetch(`${EXCHANGE_RATE_API_BASE}/${base}`, {
      headers: {
        Accept: "application/json"
      },
      next: { revalidate: 3600 } // Cache for 1 hour
    })

    if (!response.ok) {
      console.error("Exchange Rate API error:", response.status)
      return null
    }

    const data = await response.json()

    // Filter to only supported currencies
    const filteredRates: Record<string, number> = {}
    for (const currency of SUPPORTED_CURRENCIES) {
      if (data.rates[currency]) {
        filteredRates[currency] = data.rates[currency]
      }
    }

    return {
      base: data.base,
      rates: filteredRates,
      timestamp: new Date()
    }
  } catch (error) {
    console.error("Error fetching FX rates:", error)
    return null
  }
}

export function convertToUsd(
  amount: number,
  fromCurrency: SupportedCurrency,
  rates: Record<string, number>
): number {
  if (fromCurrency === "USD") {
    return amount
  }

  const rate = rates[fromCurrency]
  if (!rate) {
    console.error(`No rate found for ${fromCurrency}`)
    return amount
  }

  // rates are relative to USD, so we divide
  return amount / rate
}

export function convertFromUsd(
  amountUsd: number,
  toCurrency: SupportedCurrency,
  rates: Record<string, number>
): number {
  if (toCurrency === "USD") {
    return amountUsd
  }

  const rate = rates[toCurrency]
  if (!rate) {
    console.error(`No rate found for ${toCurrency}`)
    return amountUsd
  }

  return amountUsd * rate
}
