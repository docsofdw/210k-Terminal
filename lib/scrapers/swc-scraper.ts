/**
 * Smarter Web Company (SWC.AQ) Equity Snapshot Scraper
 * Source: https://www.smarterwebcompany.co.uk/shareholders/equity-snapshot/
 *
 * Extracts:
 * - Shares in Issue (basic shares outstanding)
 * - Pre-IPO Warrants
 * - Placing Warrants
 * - Convertible shares
 */

import {
  fetchPage,
  parseNumber,
  validateSharesData,
  type ScraperResult,
  type SharesData
} from "./base"

const SWC_URL = "https://www.smarterwebcompany.co.uk/shareholders/equity-snapshot/"

export interface SwcSharesData extends SharesData {
  preIpoWarrants?: number
  placingWarrants?: number
  convertibleShares?: number
  lastUpdated?: string
}

/**
 * Scrape SWC equity snapshot page
 */
export async function scrapeSWC(): Promise<ScraperResult<SwcSharesData>> {
  const scrapedAt = new Date()

  try {
    const { html } = await fetchPage(SWC_URL)

    // Extract shares in issue
    // Pattern: "<strong>XXX,XXX,XXX</strong> shares in issue" or "XXX,XXX,XXX shares in issue"
    const sharesMatch = html.match(
      /<strong>([\d,]+)<\/strong>\s*(?:&nbsp;)?\s*shares?\s*in\s*issue/i
    ) || html.match(/([\d,]+)\s*shares?\s*in\s*issue/i)
    const sharesInIssue = sharesMatch ? parseNumber(sharesMatch[1]) : null

    if (!sharesInIssue) {
      return {
        success: false,
        error: "Could not extract shares in issue",
        source: SWC_URL,
        scrapedAt
      }
    }

    // Extract pre-IPO warrants
    // Pattern: "<strong>XXX,XXX,XXX</strong> pre-IPO warrants"
    const preIpoMatch = html.match(
      /<strong>([\d,]+)<\/strong>\s*(?:&nbsp;)?\s*pre-?IPO\s*warrants?/i
    ) || html.match(/([\d,]+)\s*pre-?IPO\s*warrants?/i)
    const preIpoWarrants = preIpoMatch ? parseNumber(preIpoMatch[1]) : 0

    // Extract placing warrants
    // Pattern: "<strong>XXX,XXX,XXX</strong> placing warrants"
    const placingMatch = html.match(
      /<strong>([\d,]+)<\/strong>\s*(?:&nbsp;)?\s*placing\s*warrants?/i
    ) || html.match(/([\d,]+)\s*placing\s*warrants?/i)
    const placingWarrants = placingMatch ? parseNumber(placingMatch[1]) : 0

    // Extract convertible shares
    // Pattern: "<strong>XXX,XXX,XXX</strong> shares to be potentially issued"
    const convertMatch = html.match(
      /<strong>([\d,]+)<\/strong>\s*(?:&nbsp;)?\s*shares?\s*to\s*be\s*potentially\s*issued/i
    ) || html.match(/([\d,]+)\s*shares?\s*to\s*be\s*potentially\s*issued/i)
    const convertibleShares = convertMatch ? parseNumber(convertMatch[1]) : 0

    // Try to find last updated date
    // Pattern: "Last Updated: Month DD, YYYY" or similar
    const updatedMatch = html.match(
      /last\s*updated[:\s]*([\w\s,]+\d{4})/i
    )
    const lastUpdated = updatedMatch ? updatedMatch[1].trim() : undefined

    // Calculate totals
    const totalWarrants = (preIpoWarrants || 0) + (placingWarrants || 0)
    const dilutedShares =
      sharesInIssue + totalWarrants + (convertibleShares || 0)

    const data: SwcSharesData = {
      sharesOutstanding: sharesInIssue,
      dilutedShares,
      warrants: totalWarrants,
      convertibles: convertibleShares || undefined,
      preIpoWarrants: preIpoWarrants || undefined,
      placingWarrants: placingWarrants || undefined,
      lastUpdated,
      notes: `Pre-IPO: ${preIpoWarrants?.toLocaleString() || 0}, Placing: ${placingWarrants?.toLocaleString() || 0}, Converts: ${convertibleShares?.toLocaleString() || 0}`
    }

    // Validate the data
    const validation = validateSharesData(data)
    if (!validation.valid) {
      return {
        success: false,
        error: validation.errors.join("; "),
        source: SWC_URL,
        scrapedAt
      }
    }

    return {
      success: true,
      data,
      source: SWC_URL,
      scrapedAt
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      source: SWC_URL,
      scrapedAt
    }
  }
}

/**
 * Get SWC ticker for database lookup
 */
export const SWC_TICKER = "SWC.AQ"
