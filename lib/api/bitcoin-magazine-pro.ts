const BITCOIN_MAGAZINE_PRO_API_BASE = "https://api.bitcoinmagazinepro.com/metrics"

export interface OnChainMetricDataPoint {
  date: string
  [key: string]: string | number | null
}

/**
 * Fetches on-chain metrics from Bitcoin Magazine Pro API
 * Returns data as parsed JSON array from CSV response
 */
export async function fetchOnChainMetric(
  metricName: string,
  days: number = 90
): Promise<OnChainMetricDataPoint[]> {
  const apiKey = process.env.BITCOIN_MAGAZINE_PRO_API_KEY

  if (!apiKey) {
    console.error("BITCOIN_MAGAZINE_PRO_API_KEY not configured")
    return []
  }

  try {
    // Calculate date range
    const toDate = new Date()
    const fromDate = new Date()
    fromDate.setDate(fromDate.getDate() - days)

    const fromDateStr = fromDate.toISOString().split("T")[0]
    const toDateStr = toDate.toISOString().split("T")[0]

    const url = `${BITCOIN_MAGAZINE_PRO_API_BASE}/${metricName}?from_date=${fromDateStr}&to_date=${toDateStr}`

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${apiKey}`
      },
      next: { revalidate: 3600 } // Cache for 1 hour
    })

    if (!response.ok) {
      console.error(`Bitcoin Magazine Pro API error for ${metricName}:`, response.status)
      return []
    }

    // API returns JSON containing CSV string
    const csvText = await response.json()
    return parseCsvToJson(csvText)
  } catch (error) {
    console.error(`Error fetching ${metricName} from Bitcoin Magazine Pro:`, error)
    return []
  }
}

/**
 * Parse CSV string to JSON array
 */
function parseCsvToJson(csvText: string): OnChainMetricDataPoint[] {
  const lines = csvText.trim().split("\n")
  if (lines.length < 2) return []

  const headers = lines[0].split(",").map(h => h.trim())
  const data: OnChainMetricDataPoint[] = []

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(",").map(v => v.trim())
    if (values.length !== headers.length) continue

    const row: OnChainMetricDataPoint = { date: "" }
    headers.forEach((header, index) => {
      const value = values[index]
      // Try to parse as number, otherwise keep as string
      const numValue = parseFloat(value)
      // Handle Date column (case-insensitive)
      if (header.toLowerCase() === "date" || header.toLowerCase() === "time") {
        row.date = value
      } else if (!isNaN(numValue) && value !== "") {
        row[header] = numValue
      } else {
        row[header] = value || null
      }
    })
    if (row.date) {
      data.push(row)
    }
  }

  return data
}

// Specific metric endpoints
export async function getFundingRates(days: number = 90) {
  return fetchOnChainMetric("fr-average", days)
}

export async function get200WMAHeatmap(days: number = 90) {
  return fetchOnChainMetric("200wma-heatmap", days)
}

export async function getFearAndGreed(days: number = 90) {
  return fetchOnChainMetric("fear-and-greed", days)
}

export async function getPiCycleTop(days: number = 90) {
  return fetchOnChainMetric("pi-cycle-top", days)
}

export async function getBitcoinVolatility(days: number = 90) {
  return fetchOnChainMetric("bitcoin-volatility", days)
}

export async function getMvrvZScore(days: number = 90) {
  return fetchOnChainMetric("mvrv-zscore", days)
}

export async function getNupl(days: number = 90) {
  return fetchOnChainMetric("nupl", days)
}
