/**
 * Portfolio Company Scrapers Index
 *
 * Registry of all portfolio company scrapers for centralized execution
 */

export * from "./base"
export * from "./swc-scraper"
export * from "./moon-inc-scraper"
export * from "./browser-scraper"
export * from "./strategy-scraper"

import { scrapeSWC, SWC_TICKER } from "./swc-scraper"
import { MOON_INC_TICKER } from "./moon-inc-scraper"
import { scrapeStrategy, STRATEGY_TICKER } from "./strategy-scraper"
import {
  scrapeLQWD,
  LQWD_TICKER,
  scrapeCapitalB,
  CAPITAL_B_TICKER,
  scrapeOranje,
  ORANJE_TICKER,
  scrapeMetaplanet,
  METAPLANET_TICKER,
  closeBrowser
} from "./browser-scraper"
import type { ScraperResult, SharesData } from "./base"

export interface ScraperConfig {
  ticker: string
  name: string
  scraper: () => Promise<ScraperResult<SharesData>>
  enabled: boolean
  requiresBrowser?: boolean
}

/**
 * Registry of all automated scrapers
 * Add new scrapers here as they are built
 */
export const SCRAPER_REGISTRY: ScraperConfig[] = [
  {
    ticker: SWC_TICKER,
    name: "Smarter Web Company",
    scraper: scrapeSWC,
    enabled: true
  },
  {
    ticker: LQWD_TICKER,
    name: "LQWD Technologies",
    scraper: scrapeLQWD,
    enabled: true,
    requiresBrowser: true
  },
  {
    ticker: CAPITAL_B_TICKER,
    name: "Capital B",
    scraper: scrapeCapitalB,
    enabled: false, // Dashboard doesn't expose share data - use filings
    requiresBrowser: true
  },
  {
    ticker: ORANJE_TICKER,
    name: "Oranje BTC",
    scraper: scrapeOranje,
    enabled: true,
    requiresBrowser: true
  },
  {
    ticker: METAPLANET_TICKER,
    name: "Metaplanet",
    scraper: scrapeMetaplanet,
    enabled: true, // Scrapes from analytics page
    requiresBrowser: true
  },
  {
    ticker: STRATEGY_TICKER,
    name: "Strategy (MicroStrategy)",
    scraper: scrapeStrategy,
    enabled: true,
    requiresBrowser: true
  }
  // Moon Inc requires PDF URL, handled separately via scrape-moon-inc cron
]

/**
 * Run all enabled scrapers
 */
export async function runAllScrapers(): Promise<
  Array<{
    ticker: string
    name: string
    result: ScraperResult<SharesData>
  }>
> {
  const enabledScrapers = SCRAPER_REGISTRY.filter((s) => s.enabled)
  const hasBrowserScrapers = enabledScrapers.some((s) => s.requiresBrowser)

  try {
    // Run scrapers sequentially if using browser (to avoid memory issues)
    // Run in parallel if no browser scrapers
    const results: Array<{
      ticker: string
      name: string
      result: ScraperResult<SharesData>
    }> = []

    if (hasBrowserScrapers) {
      // Sequential execution for browser scrapers
      for (const config of enabledScrapers) {
        results.push({
          ticker: config.ticker,
          name: config.name,
          result: await config.scraper()
        })
      }
    } else {
      // Parallel execution for non-browser scrapers
      const parallelResults = await Promise.all(
        enabledScrapers.map(async (config) => ({
          ticker: config.ticker,
          name: config.name,
          result: await config.scraper()
        }))
      )
      results.push(...parallelResults)
    }

    return results
  } finally {
    // Clean up browser instance if used
    if (hasBrowserScrapers) {
      await closeBrowser()
    }
  }
}

/**
 * Ticker lookup for database updates
 */
export const PORTFOLIO_TICKERS = {
  SWC: SWC_TICKER,
  MOON: MOON_INC_TICKER
} as const
