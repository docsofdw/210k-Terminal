/**
 * Strategy (MSTR) Shares Page Scraper
 * Source: https://www.strategy.com/shares
 *
 * Extracts:
 * - Class A and Class B shares outstanding
 * - All convertible note tranches
 * - STRK preferred stock
 * - Options and RSUs
 * - Assumed Diluted Shares Outstanding
 */

import puppeteer from "puppeteer-core"
import chromium from "@sparticuz/chromium"
import {
  parseNumber,
  validateSharesData,
  type ScraperResult,
  type SharesData
} from "./base"

export interface StrategySharesData extends SharesData {
  classA?: number
  classB?: number
  converts?: {
    name: string
    shares: number
    strikePrice?: number
  }[]
  strkShares?: number
  optionsOutstanding?: number
  rsusUnvested?: number
  btcHoldings?: number
  lastUpdated?: string
}

const STRATEGY_URL = "https://www.strategy.com/shares"

/**
 * Scrape Strategy shares page
 */
export async function scrapeStrategy(): Promise<ScraperResult<StrategySharesData>> {
  const scrapedAt = new Date()

  try {
    const isVercel = process.env.VERCEL === "1"

    let browser
    if (isVercel) {
      browser = await puppeteer.launch({
        args: chromium.args,
        defaultViewport: { width: 1280, height: 720 },
        executablePath: await chromium.executablePath(),
        headless: true
      })
    } else {
      const executablePath =
        process.platform === "darwin"
          ? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
          : process.platform === "win32"
            ? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
            : "/usr/bin/google-chrome"

      browser = await puppeteer.launch({
        executablePath,
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox"]
      })
    }

    const page = await browser.newPage()
    await page.setUserAgent(
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
    )

    await page.goto(STRATEGY_URL, {
      waitUntil: "networkidle0",
      timeout: 45000
    })
    await new Promise((r) => setTimeout(r, 5000))

    // Get rendered text content
    const text = await page.evaluate(() => document.body.innerText)

    await browser.close()

    // The page shows data in columns by date - we want the latest (rightmost) column
    // Data is in thousands (noted in header)
    // Format: "Label(footnote)<TAB>num1<TAB>num2<TAB>...<TAB>numN"

    // Helper to extract last number from a tab-separated row (skipping footnote refs)
    const extractLastNumber = (label: string, skipFootnote = true): number | null => {
      // Match the label followed by optional footnote, then tab, then numbers until end of line
      const pattern = skipFootnote
        ? new RegExp(`${label}\\s*(?:\\(\\d+\\))?\\t([^\\n]+)`, "i")
        : new RegExp(`${label}\\t([^\\n]+)`, "i")
      const match = text.match(pattern)
      if (!match) return null
      // Extract all numbers >= 3 chars to skip dashes and small refs
      const numbers = match[1].match(/[\d,]{3,}/g)
      if (!numbers || numbers.length === 0) return null
      // Get the last (most recent) number
      return parseNumber(numbers[numbers.length - 1])
    }

    // Extract Basic Shares Outstanding row - requires (2) footnote to match data row
    let basicShares = extractLastNumber("Basic\\s+Shares\\s+Outstanding\\s*\\(2\\)", false)
    if (basicShares) basicShares *= 1000

    // Extract Assumed Diluted Shares Outstanding - requires (3) footnote to match data row
    let dilutedShares = extractLastNumber("Assumed\\s+Diluted\\s+Shares\\s+Outstanding\\s*\\(3\\)", false)
    if (dilutedShares) dilutedShares *= 1000

    // Extract Class A shares
    let classA = extractLastNumber("Class\\s+A") || undefined
    if (classA) classA *= 1000

    // Extract Class B shares
    let classB = extractLastNumber("Class\\s+B") || undefined
    if (classB) classB *= 1000

    // Extract convertible notes - format: "2025 Convert Shares @$39.80<TAB>num1<TAB>num2..."
    const converts: { name: string; shares: number; strikePrice?: number }[] = []
    const convertPattern =
      /(\d{4}\s*[AB]?\s*Convert)\s+Shares\s+@\s*\$([\d,.]+)\t([^\n]+)/gi
    let convertMatch
    while ((convertMatch = convertPattern.exec(text)) !== null) {
      // Extract numbers >= 3 digits (skip dashes and small numbers)
      const numbers = convertMatch[3].match(/[\d,]{3,}/g)
      if (numbers && numbers.length > 0) {
        const lastNum = parseNumber(numbers[numbers.length - 1])
        if (lastNum && lastNum > 0) {
          converts.push({
            name: convertMatch[1].trim(),
            shares: lastNum * 1000,
            strikePrice: parseNumber(convertMatch[2]) || undefined
          })
        }
      }
    }

    // Extract STRK preferred - format: "STRK Convert Shares @$1,000.00<TAB>-<TAB>...<TAB>1,402"
    let strkShares: number | undefined
    const strkNum = extractLastNumber("STRK\\s+Convert\\s+Shares\\s+@\\s*\\$[\\d,.]+", false)
    if (strkNum) strkShares = strkNum * 1000

    // Extract Options Outstanding
    let optionsOutstanding: number | undefined
    const optionsNum = extractLastNumber("Options\\s+Outstanding")
    if (optionsNum) optionsOutstanding = optionsNum * 1000

    // Extract RSU/PSU Unvested
    let rsusUnvested: number | undefined
    const rsusNum = extractLastNumber("RSU\\/PSU\\s+Unvested")
    if (rsusNum) rsusUnvested = rsusNum * 1000

    // Extract BTC Holdings (not in thousands)
    let btcHoldings: number | undefined
    const btcNum = extractLastNumber("Total\\s+BTC")
    if (btcNum) btcHoldings = btcNum

    // Extract last updated timestamp
    const updatedMatch = text.match(
      /Securities\s+market\s+data\s+last\s+updated:\s*([^;]+)/i
    )
    const lastUpdated = updatedMatch ? updatedMatch[1].trim() : undefined

    if (!basicShares || !dilutedShares) {
      return {
        success: false,
        error: "Could not extract shares from Strategy page",
        source: STRATEGY_URL,
        scrapedAt
      }
    }

    // Calculate total convertible shares
    const totalConvertShares = converts.reduce((sum, c) => sum + c.shares, 0)

    const data: StrategySharesData = {
      sharesOutstanding: basicShares,
      dilutedShares,
      classA,
      classB,
      converts: converts.length > 0 ? converts : undefined,
      convertibles: totalConvertShares + (strkShares || 0),
      strkShares,
      options: optionsOutstanding,
      optionsOutstanding,
      rsusUnvested,
      btcHoldings,
      lastUpdated,
      notes: `Class A: ${(classA || 0).toLocaleString()}, Class B: ${(classB || 0).toLocaleString()}, Converts: ${totalConvertShares.toLocaleString()}, STRK: ${(strkShares || 0).toLocaleString()}, Options: ${(optionsOutstanding || 0).toLocaleString()}, RSUs: ${(rsusUnvested || 0).toLocaleString()}`
    }

    const validation = validateSharesData(data)
    if (!validation.valid) {
      return {
        success: false,
        error: validation.errors.join("; "),
        source: STRATEGY_URL,
        scrapedAt
      }
    }

    return {
      success: true,
      data,
      source: STRATEGY_URL,
      scrapedAt
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Browser scraping failed",
      source: STRATEGY_URL,
      scrapedAt
    }
  }
}

export const STRATEGY_TICKER = "MSTR"
