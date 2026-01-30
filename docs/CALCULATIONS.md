# Calculations & Business Logic

All formulas must match the existing Google Sheets calculations exactly.

## Core Comps Table Metrics

### BTC NAV (USD)

```
BTC_NAV = BTC_Holdings * BTC_Price_USD
```

The total USD value of Bitcoin held by the company.

---

### Market Cap (USD)

```
Mkt_Cap_Local = Share_Count * Local_Price
Mkt_Cap_USD = Mkt_Cap_Local * FX_Rate_to_USD
```

For USD-denominated stocks, FX_Rate = 1.

---

### Enterprise Value (USD)

```
EV_USD = Mkt_Cap_USD + Debt_USD + Preferreds_USD - Cash_USD
```

Note: Preferreds are added to EV (treated as debt-like for mNAV purposes).

---

### mNAV (Multiple of Net Asset Value)

```
mNAV = EV_USD / BTC_NAV
```

The core valuation metric:
- mNAV > 1 = premium to NAV
- mNAV < 1 = discount to NAV

---

### Diluted mNAV (D.mNAV)

```
Diluted_Shares = Basic_Shares + Warrants + Options + Convertibles
Diluted_Mkt_Cap = Diluted_Shares * Stock_Price
Diluted_EV = Diluted_Mkt_Cap + Debt_USD + Preferreds_USD - Cash_USD
Diluted_mNAV = Diluted_EV / BTC_NAV
```

**Why Diluted mNAV matters:**
- Companies like XXI have significant dilution (10.3M basic → 709.9M diluted shares)
- Basic mNAV can be misleading (XXI: 0.02x basic vs 1.50x diluted)
- Diluted mNAV reflects the true valuation including all potential shares

**UI Labels:**
- Comps table: "D.mNAV" column
- Value Screener: "D.mNAV" column
- Charts: "D.mNAV" in legends and tooltips

**Calculation Example (XXI):**
```
Basic Shares: 10,300,000
Diluted Shares: 709,924,346
Stock Price: $7.63
BTC Holdings: 43,514
BTC Price: $84,294

Basic Mkt Cap = 10.3M × $7.63 = $78.6M
Diluted Mkt Cap = 709.9M × $7.63 = $5.42B

BTC NAV = 43,514 × $84,294 = $3.67B

Basic mNAV = $78.6M / $3.67B = 0.02x
Diluted mNAV = $5.42B / $3.67B = 1.48x
```

---

### 1x D.mNAV Price

```
Price_at_1x = Current_Price / Diluted_mNAV
```

The theoretical stock price if the company traded at exactly 1x diluted mNAV (fair value based on BTC holdings).

---

### Fiat Debt to BTC NAV

```
Fiat_Debt_Ratio = Debt_USD / BTC_NAV
```

Measures leverage against BTC holdings.

---

### BTC per Share

```
BTC_per_Share = BTC_Holdings / Share_Count
```

---

### Sats per Share

```
Sats_per_Share = (BTC_Holdings * 100,000,000) / Share_Count
```

---

### Sats per Dollar of Share Price

```
Sats_per_Dollar = Sats_per_Share / (Local_Price * FX_Rate_to_USD)
```

Useful for comparing how many sats you get per dollar invested.

---

## BTC Yield Metrics

### BTC Yield YTD (%)

```
BTC_Yield_YTD = (Current_BTC - Start_of_Year_BTC) / Start_of_Year_BTC
```

Percentage increase in BTC holdings year-to-date.

---

### Adjusted BTC Yield

```
Adj_BTC_Yield = (1 - BTC_Yield_Discount) * BTC_Yield_YTD
```

`BTC_Yield_Discount` is a subjective discount (0-1) based on track record and treasury size. Manually set per company.

---

### Months to Cover mNAV

```
Monthly_BTC_Yield_Rate = (1 + BTC_Yield_YTD)^(1/Months_YTD) - 1
Months_to_Cover = LOG(mNAV) / LOG(1 + Monthly_BTC_Yield_Rate)
```

Estimates how many months of BTC accumulation needed to justify current premium.

---

### Risk-Adjusted Months to Cover

```
Risk_Adj_MmC = (1 + Debt_USD / (Mkt_Cap_USD - Debt_USD)) * Months_to_Cover
```

Adjusts for leverage risk.

---

## Accumulation Metrics

### Days Since First Purchase

```
Days_Since_First = TODAY() - First_Purchase_Date
```

---

### BTC Bought per Day

```
BTC_per_Day = BTC_Holdings / Days_Since_First
```

---

### Percent of New Daily Supply

```
Pct_Daily_Supply = BTC_per_Day / 450
```

450 BTC is the approximate daily new supply post-2024 halving.

---

## Portfolio Calculations

### Position Value (USD)

```
Value_USD = Quantity * Price_Local * FX_Rate_to_USD
```

---

### Position Value (BTC)

```
Value_BTC = Value_USD / BTC_Price_USD
```

---

### Portfolio Weight

```
Weight_Pct = Value_USD / Total_AUM_USD
```

---

### Bitcoin Delta

```
BTC_Delta = Delta_Pct * Value_BTC
```

`Delta_Pct` is the estimated beta to BTC (e.g., 1.25 for high-beta treasury stocks).

---

### Total Portfolio Metrics

```
Total_AUM_USD = SUM(all position values)
Total_AUM_BTC = Total_AUM_USD / BTC_Price_USD
Total_BTC_Delta = SUM(all position BTC deltas)
Pct_Long = Total_BTC_Delta / Total_AUM_BTC
```

---

## FX Conversion

### Supported Currencies

| Currency | Code | Example Company |
|----------|------|-----------------|
| US Dollar | USD | ABTC, Strategy |
| Canadian Dollar | CAD | BTCT.V, LQWD.V, MATA.V |
| Japanese Yen | JPY | Metaplanet (3350.T) |
| Hong Kong Dollar | HKD | Moon Inc (1723.HK) |
| British Pound | GBP | SATS.L, SWC.AQ |
| Euro | EUR | ALCPB.PA, EBEN.HM, TRSR |
| Australian Dollar | AUD | DCC.AX |
| Brazilian Real | BRL | OBTC3 |
| Thai Baht | THB | DV8.BK |
| South Korean Won | KRW | 049470.KQ |

### Conversion Formula

```
USD_Value = Local_Value * (1 / FX_Rate_to_Local)
```

FX rates fetched daily from exchangerate-api.com or Open Exchange Rates.

---

## Special Notes

### LSE Prices (UK)

LSE prices are quoted in **pence**, not pounds. Divide by 100 to get GBP:

```
Price_GBP = Price_Pence / 100
```

### Private Companies

Treasury BV (TRSR) is private - manual entry only, no price feed.
