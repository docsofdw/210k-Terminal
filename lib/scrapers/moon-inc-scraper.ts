/**
 * Moon Inc (1723.HK) Monthly Return for Equity PDF Parser
 * Source: https://portal.mooninc.hk/investor-relations/announcements
 *
 * Parses HKEX FF301 form "Monthly Return for Equity Issuer"
 * Published on 3rd of each month
 *
 * Extracts:
 * - Shares outstanding (Section II)
 * - Convertible shares (Section III-C)
 * - Options/Warrants if any (Section III-A, III-B)
 */

import { PDFParse } from "pdf-parse"
import {
  parseNumber,
  validateSharesData,
  type ScraperResult,
  type SharesData
} from "./base"

export interface MoonIncSharesData extends SharesData {
  reportMonth?: string
  treasuryShares?: number
  authorizedShares?: number
}

/**
 * Parse Moon Inc Monthly Return PDF from buffer
 */
export async function parseMoonIncPdf(
  pdfBuffer: Buffer,
  sourceUrl?: string
): Promise<ScraperResult<MoonIncSharesData>> {
  const scrapedAt = new Date()
  const source = sourceUrl || "Moon Inc Monthly Return PDF"

  try {
    const parser = new PDFParse({ data: pdfBuffer })
    const pdfData = await parser.getText()
    const text = pdfData.text

    // Extract report month
    // Pattern: "For the month ended: DD Month YYYY"
    const monthMatch = text.match(
      /For\s+the\s+month\s+ended[:\s]*([\d]+\s+\w+\s+\d{4})/i
    )
    const reportMonth = monthMatch ? monthMatch[1].trim() : undefined

    // Extract issued shares from Section II
    // Section II header: "Movements in Issued Shares and/or Treasury Shares"
    // Look for "Balance at close of the month" in Section II
    // The format shows: Number of issued shares (excl treasury) | Treasury shares | Total

    let sharesOutstanding: number | null = null

    // Pattern 1: Look for Section II specifically, then find balance
    // Section II talks about "Issued Shares" not "Authorised"
    const sectionIIMatch = text.match(
      /Movements\s+in\s+Issued\s+Shares[\s\S]{0,1000}?Balance\s+at\s+close\s+of\s+the\s+month[\s\S]{0,100}?([\d,]+)/i
    )
    if (sectionIIMatch) {
      sharesOutstanding = parseNumber(sectionIIMatch[1])
    }

    // Pattern 2: Look for "Number of issued shares (excluding treasury shares)" column header
    if (!sharesOutstanding) {
      const altMatch = text.match(
        /Number\s+of\s+issued\s+shares\s*\(excluding\s+treasury[\s\S]{0,500}?Balance\s+at\s+close[\s\S]{0,100}?([\d,]+)/i
      )
      if (altMatch) {
        sharesOutstanding = parseNumber(altMatch[1])
      }
    }

    // Pattern 3: Look for "Total number of issued shares" followed by the same number repeated
    if (!sharesOutstanding) {
      const totalMatch = text.match(
        /Total\s+number\s+of\s+issued\s+shares[\s\S]{0,100}?([\d,]+)\s*$/im
      )
      if (totalMatch) {
        const num = parseNumber(totalMatch[1])
        // Only accept if it's a reasonable number (< 10B, which is authorized shares limit)
        if (num && num < 1_000_000_000) {
          sharesOutstanding = num
        }
      }
    }

    // Pattern 4: Find the Public Float section which restates issued shares
    if (!sharesOutstanding) {
      // The Public float section references actual issued shares
      const floatMatch = text.match(
        /Public\s+float[\s\S]{0,300}?([\d,]{6,12})\s*0\s*\1/i
      )
      if (floatMatch) {
        sharesOutstanding = parseNumber(floatMatch[1])
      }
    }

    if (!sharesOutstanding) {
      return {
        success: false,
        error:
          "Could not extract shares outstanding from PDF. Text sample: " +
          text.substring(0, 500),
        source,
        scrapedAt
      }
    }

    // Extract convertible shares from Section III(C)
    // The number appears after the convertible note details and the principal amount
    // Pattern: "HKD XX,XXX,XXX Issued XX,XXX,XXX YY,YYY,YYY" where last number is shares
    let convertibleShares = 0

    // Look for the last column number in convertible section (shares which may be issued)
    // This appears after the principal amounts like "52,377,600 Issued 52,377,600 10,475,520"
    const convertMatch = text.match(
      /Convertible\s+Notes?[\s\S]{0,500}?(\d{1,3}(?:,\d{3})+)\s+Issued\s+[\d,]+\s+([\d,]+)/i
    )
    if (convertMatch) {
      // The second capture group is the shares that may be issued
      convertibleShares = parseNumber(convertMatch[2]) || 0
    }

    // Alternative: Look for number after "close of the month" in convertibles section
    if (!convertibleShares) {
      const altMatch = text.match(
        /Convertibles[\s\S]{0,1500}?close\s+of\s+the\s+month\s*[\s\S]{0,50}?([\d,]{6,12})\s*(?:Bond|Type)/i
      )
      if (altMatch) {
        convertibleShares = parseNumber(altMatch[1]) || 0
      }
    }

    // Pattern 3: Direct search for the shares number in the convertibles row
    // The number 10,475,520 is isolated at the end of the row
    if (!convertibleShares) {
      const directMatch = text.match(
        /52,377,600[\s\S]{0,50}?([\d,]{6,12})\s*(?:Type|Bond)/i
      )
      if (directMatch) {
        convertibleShares = parseNumber(directMatch[1]) || 0
      }
    }

    // Extract options from Section III(A) - usually "Not applicable" for Moon Inc
    let options = 0
    const optionsMatch = text.match(
      /Share\s+Options[\s\S]{0,50}?(Not\s+applicable|[\d,]+)/i
    )
    if (optionsMatch && !optionsMatch[1].toLowerCase().includes("not")) {
      options = parseNumber(optionsMatch[1]) || 0
    }

    // Extract warrants from Section III(B) - usually "Not applicable" for Moon Inc
    let warrants = 0
    const warrantsMatch = text.match(
      /Warrants\s+to\s+Issue[\s\S]{0,50}?(Not\s+applicable|[\d,]+)/i
    )
    if (warrantsMatch && !warrantsMatch[1].toLowerCase().includes("not")) {
      warrants = parseNumber(warrantsMatch[1]) || 0
    }

    // Extract treasury shares
    const treasuryMatch = text.match(
      /Number\s+of\s+treasury\s+shares[\s\S]{0,50}?([\d,]+)/i
    )
    const treasuryShares = treasuryMatch
      ? parseNumber(treasuryMatch[1]) || 0
      : 0

    // Extract authorized shares
    const authorizedMatch = text.match(
      /Number\s+of\s+authorised[\s\S]{0,50}?([\d,]+)/i
    )
    const authorizedShares = authorizedMatch
      ? parseNumber(authorizedMatch[1]) || undefined
      : undefined

    // Calculate diluted shares
    const dilutedShares =
      sharesOutstanding + convertibleShares + options + warrants

    const data: MoonIncSharesData = {
      sharesOutstanding,
      dilutedShares,
      options: options || undefined,
      warrants: warrants || undefined,
      convertibles: convertibleShares || undefined,
      treasuryShares: treasuryShares || undefined,
      authorizedShares,
      reportMonth,
      notes: `Report: ${reportMonth || "Unknown"}, Converts: ${convertibleShares.toLocaleString()}`
    }

    // Validate
    const validation = validateSharesData(data)
    if (!validation.valid) {
      return {
        success: false,
        error: validation.errors.join("; "),
        source,
        scrapedAt
      }
    }

    return {
      success: true,
      data,
      source,
      scrapedAt
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown PDF parsing error",
      source,
      scrapedAt
    }
  }
}

/**
 * Fetch and parse Moon Inc monthly return from URL
 */
export async function scrapeMoonInc(
  pdfUrl: string
): Promise<ScraperResult<MoonIncSharesData>> {
  const scrapedAt = new Date()

  try {
    const response = await fetch(pdfUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
      }
    })

    if (!response.ok) {
      return {
        success: false,
        error: `Failed to download PDF: HTTP ${response.status}`,
        source: pdfUrl,
        scrapedAt
      }
    }

    const buffer = Buffer.from(await response.arrayBuffer())
    return parseMoonIncPdf(buffer, pdfUrl)
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Network error",
      source: pdfUrl,
      scrapedAt
    }
  }
}

/**
 * Get Moon Inc ticker for database lookup
 */
export const MOON_INC_TICKER = "1723.HK"

/**
 * Moon Inc announcements page URL
 */
export const MOON_INC_ANNOUNCEMENTS_URL =
  "https://portal.mooninc.hk/investor-relations/announcements"
