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
