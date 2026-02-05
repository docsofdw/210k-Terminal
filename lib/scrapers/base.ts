/**
 * Base scraper utilities for portfolio company data extraction
 */

export interface ScraperResult<T = unknown> {
  success: boolean
  data?: T
  error?: string
  source: string
  scrapedAt: Date
  rawHtml?: string // For debugging
}

export interface SharesData {
  sharesOutstanding: number
  dilutedShares: number
  options?: number
  warrants?: number
  convertibles?: number
  rsus?: number
  notes?: string
}

export interface ValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
}

/**
 * Fetch HTML content from a URL with retry logic
 */
export async function fetchPage(
  url: string,
  options?: {
    retries?: number
    timeout?: number
    headers?: Record<string, string>
  }
): Promise<{ html: string; status: number }> {
  const { retries = 3, timeout = 30000, headers = {} } = options || {}

  const defaultHeaders = {
    "User-Agent":
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    Accept:
      "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.5",
    ...headers
  }

  let lastError: Error | null = null

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), timeout)

      const response = await fetch(url, {
        headers: defaultHeaders,
        signal: controller.signal
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const html = await response.text()
      return { html, status: response.status }
    } catch (error) {
      lastError = error as Error
      if (attempt < retries) {
        // Exponential backoff
        await new Promise((r) => setTimeout(r, Math.pow(2, attempt) * 1000))
      }
    }
  }

  throw lastError || new Error("Failed to fetch page")
}

/**
 * Parse a number from text, handling various formats
 * Examples: "478,272,000", "10.5M", "$1,234.56", "1,234,567"
 */
export function parseNumber(text: string | null | undefined): number | null {
  if (!text) return null

  // Remove currency symbols, whitespace, and other common characters
  let cleaned = text
    .replace(/[$€£¥₿HKD]/gi, "")
    .replace(/\s/g, "")
    .trim()

  // Handle suffixes (K, M, B, T)
  const suffixMatch = cleaned.match(/^([\d.,]+)([KMBT])$/i)
  if (suffixMatch) {
    const num = parseFloat(suffixMatch[1].replace(/,/g, ""))
    const suffix = suffixMatch[2].toUpperCase()
    const multipliers: Record<string, number> = {
      K: 1_000,
      M: 1_000_000,
      B: 1_000_000_000,
      T: 1_000_000_000_000
    }
    return num * (multipliers[suffix] || 1)
  }

  // Remove commas and parse
  cleaned = cleaned.replace(/,/g, "")

  const num = parseFloat(cleaned)
  return isNaN(num) ? null : num
}

/**
 * Validate shares data against expected ranges
 */
export function validateSharesData(
  data: SharesData,
  previousData?: SharesData
): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  // Range checks
  if (data.sharesOutstanding <= 0) {
    errors.push("Shares outstanding must be positive")
  }
  if (data.sharesOutstanding > 100_000_000_000) {
    errors.push("Shares outstanding exceeds 100B - likely parsing error")
  }

  if (data.dilutedShares < data.sharesOutstanding) {
    errors.push("Diluted shares cannot be less than shares outstanding")
  }

  // Change threshold warnings (if previous data provided)
  if (previousData) {
    const sharesChange = Math.abs(
      (data.sharesOutstanding - previousData.sharesOutstanding) /
        previousData.sharesOutstanding
    )
    if (sharesChange > 0.5) {
      warnings.push(
        `Shares outstanding changed by ${(sharesChange * 100).toFixed(1)}% - verify this is correct`
      )
    }

    const dilutedChange = Math.abs(
      (data.dilutedShares - previousData.dilutedShares) /
        previousData.dilutedShares
    )
    if (dilutedChange > 0.5) {
      warnings.push(
        `Diluted shares changed by ${(dilutedChange * 100).toFixed(1)}% - verify this is correct`
      )
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  }
}

/**
 * Extract text content between two markers in HTML
 */
export function extractBetween(
  html: string,
  startMarker: string,
  endMarker: string
): string | null {
  const startIndex = html.indexOf(startMarker)
  if (startIndex === -1) return null

  const searchStart = startIndex + startMarker.length
  const endIndex = html.indexOf(endMarker, searchStart)
  if (endIndex === -1) return null

  return html.substring(searchStart, endIndex).trim()
}

/**
 * Simple HTML table parser - extracts rows and cells
 */
export function parseHtmlTable(
  html: string
): Array<{ header?: string; value: string }[]> {
  const rows: Array<{ header?: string; value: string }[]> = []

  // Match table rows
  const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi
  let rowMatch

  while ((rowMatch = rowRegex.exec(html)) !== null) {
    const rowHtml = rowMatch[1]
    const cells: { header?: string; value: string }[] = []

    // Match cells (th or td)
    const cellRegex = /<(th|td)[^>]*>([\s\S]*?)<\/\1>/gi
    let cellMatch

    while ((cellMatch = cellRegex.exec(rowHtml)) !== null) {
      const isHeader = cellMatch[1].toLowerCase() === "th"
      // Strip HTML tags and decode entities
      const value = cellMatch[2]
        .replace(/<[^>]+>/g, "")
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .trim()

      cells.push(isHeader ? { header: value, value } : { value })
    }

    if (cells.length > 0) {
      rows.push(cells)
    }
  }

  return rows
}

/**
 * Format shares data for logging/display
 */
export function formatSharesData(data: SharesData): string {
  const parts = [
    `Outstanding: ${data.sharesOutstanding.toLocaleString()}`,
    `Diluted: ${data.dilutedShares.toLocaleString()}`
  ]

  if (data.options) parts.push(`Options: ${data.options.toLocaleString()}`)
  if (data.warrants) parts.push(`Warrants: ${data.warrants.toLocaleString()}`)
  if (data.convertibles)
    parts.push(`Converts: ${data.convertibles.toLocaleString()}`)

  return parts.join(" | ")
}
