/**
 * Browser-based scraper for JavaScript-rendered dashboards
 * Uses Puppeteer to render pages and extract data
 *
 * Works for: LQWD, Capital B, Oranje, Metaplanet dashboards
 */

import puppeteer, { Browser, Page } from "puppeteer-core"
import chromium from "@sparticuz/chromium"
import {
  parseNumber,
  validateSharesData,
  type ScraperResult,
  type SharesData
} from "./base"

let browserInstance: Browser | null = null

/**
 * Get or create a browser instance
 */
async function getBrowser(): Promise<Browser> {
  if (browserInstance) {
    return browserInstance
  }

  const isVercel = process.env.VERCEL === "1"

  if (isVercel) {
    // Serverless environment
    browserInstance = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: { width: 1280, height: 720 },
      executablePath: await chromium.executablePath(),
      headless: true
    })
  } else {
    // Local development - use system Chrome
    const executablePath =
      process.platform === "darwin"
        ? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
        : process.platform === "win32"
          ? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
          : "/usr/bin/google-chrome"

    browserInstance = await puppeteer.launch({
      executablePath,
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"]
    })
  }

  return browserInstance
}

/**
 * Close the browser instance
 */
export async function closeBrowser(): Promise<void> {
  if (browserInstance) {
    await browserInstance.close()
    browserInstance = null
  }
}

/**
 * Extract text content from a page by selector
 */
async function extractText(page: Page, selector: string): Promise<string | null> {
  try {
    await page.waitForSelector(selector, { timeout: 10000 })
    const text = await page.$eval(selector, (el) => el.textContent?.trim() || "")
    return text || null
  } catch {
    return null
  }
}

/**
 * Extract number from page by looking for text patterns
 */
async function extractNumberByPattern(
  page: Page,
  pattern: RegExp
): Promise<number | null> {
  const content = await page.content()
  const match = content.match(pattern)
  return match ? parseNumber(match[1]) : null
}

// ============================================================================
// LQWD Technologies Scraper
// ============================================================================

export interface LqwdSharesData extends SharesData {
  warrantDetails?: Array<{ name: string; quantity: number; expiry?: string }>
}

export async function scrapeLQWD(): Promise<ScraperResult<LqwdSharesData>> {
  const scrapedAt = new Date()
  const source = "https://treasury.lqwdtech.com/?tab=shares"

  try {
    const browser = await getBrowser()
    const page = await browser.newPage()

    await page.goto(source, { waitUntil: "networkidle0", timeout: 30000 })
    await new Promise((r) => setTimeout(r, 5000)) // Wait for JS rendering

    // Get rendered text content (not HTML)
    const text = await page.evaluate(() => document.body.innerText)

    // LQWD shows data in table format:
    // "Basic Shares Outstanding    31,863,408    31,863,408    31,863,408"
    // "Assumed Diluted Shares Outstanding    42,678,465    ..."

    // Extract Basic Shares Outstanding
    const basicMatch = text.match(
      /Basic\s+Shares\s+Outstanding\s+([\d,]+)/i
    )
    const sharesOutstanding = basicMatch ? parseNumber(basicMatch[1]) : null

    // Extract Diluted Shares
    const dilutedMatch = text.match(
      /(?:Assumed\s+)?Diluted\s+Shares\s+Outstanding\s+([\d,]+)/i
    )
    const dilutedShares = dilutedMatch ? parseNumber(dilutedMatch[1]) : null

    // Extract "Other" (warrants, options, etc.)
    const otherMatch = text.match(/↳\s*Other\s+([\d,]+)/i)
    const other = otherMatch ? parseNumber(otherMatch[1]) : null

    await page.close()

    if (!sharesOutstanding) {
      return {
        success: false,
        error: "Could not extract shares outstanding from LQWD dashboard",
        source,
        scrapedAt
      }
    }

    const data: LqwdSharesData = {
      sharesOutstanding,
      dilutedShares: dilutedShares || sharesOutstanding,
      warrants: other || undefined,
      notes: `Basic: ${sharesOutstanding?.toLocaleString()}, Diluted: ${dilutedShares?.toLocaleString()}, Other: ${other?.toLocaleString() || 0}`
    }

    const validation = validateSharesData(data)
    if (!validation.valid) {
      return {
        success: false,
        error: validation.errors.join("; "),
        source,
        scrapedAt
      }
    }

    return { success: true, data, source, scrapedAt }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Browser scraping failed",
      source,
      scrapedAt
    }
  }
}

export const LQWD_TICKER = "LQWD.V"

// ============================================================================
// Capital B Scraper
// ============================================================================

export async function scrapeCapitalB(): Promise<ScraperResult<SharesData>> {
  const scrapedAt = new Date()
  const source = "https://cptlb.com/analytics/"

  try {
    const browser = await getBrowser()
    const page = await browser.newPage()

    await page.goto(source, { waitUntil: "networkidle0", timeout: 30000 })
    await new Promise((r) => setTimeout(r, 3000))

    const content = await page.content()

    // Look for basic/diluted shares patterns
    const basicMatch = content.match(
      /(?:basic\s*shares?|shares?\s*outstanding)[\s\S]{0,100}?([\d,]+)/i
    )
    const sharesOutstanding = basicMatch ? parseNumber(basicMatch[1]) : null

    const dilutedMatch = content.match(
      /(?:diluted\s*shares?|fully\s*diluted)[\s\S]{0,100}?([\d,]+)/i
    )
    const dilutedShares = dilutedMatch ? parseNumber(dilutedMatch[1]) : null

    await page.close()

    if (!sharesOutstanding) {
      return {
        success: false,
        error: "Could not extract shares from Capital B analytics",
        source,
        scrapedAt
      }
    }

    const data: SharesData = {
      sharesOutstanding,
      dilutedShares: dilutedShares || sharesOutstanding
    }

    return { success: true, data, source, scrapedAt }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Browser scraping failed",
      source,
      scrapedAt
    }
  }
}

export const CAPITAL_B_TICKER = "ALCPB.PA"

// ============================================================================
// Oranje BTC Scraper
// ============================================================================

export async function scrapeOranje(): Promise<ScraperResult<SharesData>> {
  const scrapedAt = new Date()
  const source = "https://www.oranjebtc.com/dashboard"

  try {
    const browser = await getBrowser()
    const page = await browser.newPage()

    await page.goto(source, { waitUntil: "networkidle0", timeout: 30000 })
    await new Promise((r) => setTimeout(r, 5000))

    // Get rendered text content
    const text = await page.evaluate(() => document.body.innerText)

    // Oranje dashboard (Portuguese):
    // VALOR DE MERCADO (Market Cap): R$ 1.009.713.250
    // PREÇO OBTC3 (Price): R$ 6,50
    // We can calculate: Shares = Market Cap / Price

    // Extract market cap - look for "VALOR DE MERCADO" followed by R$ number
    const marketCapMatch = text.match(
      /VALOR\s+DE\s+MERCADO[\s\S]{0,50}?R\$\s*([\d.,]+)/i
    )

    // Extract price - look for "PREÇO OBTC3" followed by R$ number
    const priceMatch = text.match(/PREÇO\s+OBTC3[\s\S]{0,30}?R\$\s*([\d.,]+)/i)

    await page.close()

    if (!marketCapMatch || !priceMatch) {
      return {
        success: false,
        error:
          "Could not extract market cap or price from Oranje dashboard",
        source,
        scrapedAt
      }
    }

    // Parse Brazilian number format (1.009.713.250 and 6,50)
    const marketCapStr = marketCapMatch[1].replace(/\./g, "").replace(",", ".")
    const priceStr = priceMatch[1].replace(/\./g, "").replace(",", ".")

    const marketCap = parseFloat(marketCapStr)
    const price = parseFloat(priceStr)

    if (isNaN(marketCap) || isNaN(price) || price === 0) {
      return {
        success: false,
        error: "Invalid market cap or price values",
        source,
        scrapedAt
      }
    }

    // Calculate shares from market cap / price
    const sharesOutstanding = Math.round(marketCap / price)

    const data: SharesData = {
      sharesOutstanding,
      dilutedShares: sharesOutstanding, // No dilution data available
      notes: `Calculated from Market Cap R$${marketCap.toLocaleString()} / Price R$${price.toFixed(2)}`
    }

    const validation = validateSharesData(data)
    if (!validation.valid) {
      return {
        success: false,
        error: validation.errors.join("; "),
        source,
        scrapedAt
      }
    }

    return { success: true, data, source, scrapedAt }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Browser scraping failed",
      source,
      scrapedAt
    }
  }
}

export const ORANJE_TICKER = "OBTC3"

// ============================================================================
// Metaplanet Scraper (from disclosure page)
// ============================================================================

export async function scrapeMetaplanet(): Promise<ScraperResult<SharesData>> {
  const scrapedAt = new Date()
  const source = "https://metaplanet.jp/en/shareholders/disclosures"

  try {
    const browser = await getBrowser()
    const page = await browser.newPage()

    await page.goto(source, { waitUntil: "networkidle0", timeout: 30000 })
    await new Promise((r) => setTimeout(r, 3000))

    const content = await page.content()

    // Metaplanet disclosures page - look for latest share count
    // This is complex because data is in PDFs, so we may only get metadata
    const sharesMatch = content.match(
      /(?:shares?\s*outstanding|issued\s*shares?|total\s*shares?)[\s\S]{0,100}?([\d,]+)/i
    )
    const sharesOutstanding = sharesMatch ? parseNumber(sharesMatch[1]) : null

    await page.close()

    if (!sharesOutstanding) {
      return {
        success: false,
        error:
          "Could not extract shares from Metaplanet disclosures - may require PDF parsing",
        source,
        scrapedAt
      }
    }

    const data: SharesData = {
      sharesOutstanding,
      dilutedShares: sharesOutstanding // Would need warrant data from separate source
    }

    return { success: true, data, source, scrapedAt }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Browser scraping failed",
      source,
      scrapedAt
    }
  }
}

export const METAPLANET_TICKER = "3350.T"
