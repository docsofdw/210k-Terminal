const COINGECKO_API_BASE = "https://api.coingecko.com/api/v3"

export interface BtcPriceData {
  priceUsd: number
  high24h: number | null
  low24h: number | null
  volume24h: number | null
  change24h: number | null
  marketCap: number | null
  timestamp: Date
}

export async function getBtcPrice(): Promise<BtcPriceData | null> {
  try {
    const response = await fetch(
      `${COINGECKO_API_BASE}/simple/price?ids=bitcoin&vs_currencies=usd&include_24hr_vol=true&include_24hr_change=true&include_market_cap=true`,
      {
        headers: {
          Accept: "application/json"
        },
        next: { revalidate: 60 } // Cache for 1 minute
      }
    )

    if (!response.ok) {
      console.error("CoinGecko API error:", response.status)
      return null
    }

    const data = await response.json()

    if (!data.bitcoin?.usd) {
      console.error("Invalid CoinGecko response:", data)
      return null
    }

    return {
      priceUsd: data.bitcoin.usd,
      high24h: null, // Simple endpoint doesn't include high/low
      low24h: null,
      volume24h: data.bitcoin.usd_24h_vol ?? null,
      change24h: data.bitcoin.usd_24h_change ?? null,
      marketCap: data.bitcoin.usd_market_cap ?? null,
      timestamp: new Date()
    }
  } catch (error) {
    console.error("Error fetching BTC price from CoinGecko:", error)
    return null
  }
}

export async function getBtcPriceDetailed(): Promise<BtcPriceData | null> {
  try {
    const response = await fetch(
      `${COINGECKO_API_BASE}/coins/bitcoin?localization=false&tickers=false&community_data=false&developer_data=false`,
      {
        headers: {
          Accept: "application/json"
        },
        next: { revalidate: 60 }
      }
    )

    if (!response.ok) {
      console.error("CoinGecko API error:", response.status)
      return null
    }

    const data = await response.json()
    const marketData = data.market_data

    if (!marketData?.current_price?.usd) {
      console.error("Invalid CoinGecko detailed response")
      return null
    }

    return {
      priceUsd: marketData.current_price.usd,
      high24h: marketData.high_24h?.usd ?? null,
      low24h: marketData.low_24h?.usd ?? null,
      volume24h: marketData.total_volume?.usd ?? null,
      change24h: marketData.price_change_percentage_24h ?? null,
      marketCap: marketData.market_cap?.usd ?? null,
      timestamp: new Date()
    }
  } catch (error) {
    console.error("Error fetching detailed BTC price:", error)
    return null
  }
}

export async function getBtcHistoricalPrices(
  days: number = 30
): Promise<Array<{ date: Date; price: number }>> {
  try {
    const response = await fetch(
      `${COINGECKO_API_BASE}/coins/bitcoin/market_chart?vs_currency=usd&days=${days}`,
      {
        headers: {
          Accept: "application/json"
        },
        next: { revalidate: 3600 } // Cache for 1 hour
      }
    )

    if (!response.ok) {
      console.error("CoinGecko historical API error:", response.status)
      return []
    }

    const data = await response.json()

    return (data.prices || []).map(([timestamp, price]: [number, number]) => ({
      date: new Date(timestamp),
      price
    }))
  } catch (error) {
    console.error("Error fetching BTC historical prices:", error)
    return []
  }
}
