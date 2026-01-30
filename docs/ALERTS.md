# Alert System Specification

## mNAV Threshold Framework

Configurable at both global and per-company level.

| Threshold | Condition | Interpretation | Default Action |
|-----------|-----------|----------------|----------------|
| < 0.8 | Deep discount | Bullish signal, potential buying opportunity | Telegram alert |
| < 1.0 | Below NAV | Trading at discount to BTC value | Info only |
| 1.0 - 1.5 | Fair value range | Normal range | No alert |
| > 1.5 | Moderate premium | Elevated valuation | Info only |
| > 2.0 | High premium | Watch closely | Slack alert |
| > 3.0 | Extreme premium | Risk alert | Telegram + Slack |
| > 20% change in 24h | Rapid movement | Immediate attention needed | Telegram alert |

Per-company configuration allows higher thresholds for companies that historically trade at premiums (e.g., Strategy).

---

## Alert Types

### Company-Specific Alerts

| Alert Type | Trigger Condition | Channel | Priority |
|------------|-------------------|---------|----------|
| `price_above` | Stock price exceeds threshold | Telegram/Slack | High |
| `price_below` | Stock price drops below threshold | Telegram/Slack | High |
| `mnav_above` | mNAV exceeds threshold | Telegram/Slack | High |
| `mnav_below` | mNAV drops below threshold | Telegram/Slack | High |
| `btc_holdings` | BTC holdings change detected | Telegram/Slack | High |
| `pct_change_up` | Price increases by X% | Telegram/Slack | Medium |
| `pct_change_down` | Price decreases by X% | Telegram/Slack | Medium |

### On-Chain Metric Alerts

| Alert Type | Trigger Condition | Threshold Help | Channel |
|------------|-------------------|----------------|---------|
| `fear_greed_above` | Fear & Greed Index exceeds value | 0-100 scale. Extreme greed > 80, greed > 60 | Telegram/Slack |
| `fear_greed_below` | Fear & Greed Index drops below value | 0-100 scale. Extreme fear < 20, fear < 40 | Telegram/Slack |
| `mvrv_above` | MVRV Z-Score exceeds value | Overvalued > 5, high > 3 | Telegram/Slack |
| `mvrv_below` | MVRV Z-Score drops below value | Undervalued < 0, fair < 3 | Telegram/Slack |
| `nupl_above` | NUPL exceeds value | Euphoria > 0.75, belief > 0.5 (decimal 0-1) | Telegram/Slack |
| `nupl_below` | NUPL drops below value | Capitulation < 0, hope < 0.25 (decimal) | Telegram/Slack |
| `funding_rate_above` | Funding rate exceeds value | As % (e.g., 0.01 for 0.01%) | Telegram/Slack |
| `funding_rate_below` | Funding rate drops below value | As % (e.g., -0.01 for -0.01%) | Telegram/Slack |

### Daily Digest

| Alert Type | Description | Channel |
|------------|-------------|---------|
| `onchain_daily_digest` | Daily summary of all on-chain metrics at 9 AM ET | Telegram/Slack |

**Digest includes:**
- Fear & Greed Index with sentiment label
- MVRV Z-Score with valuation zone
- NUPL with market cycle phase
- Funding Rates with trend
- Premium/discount to 200 Week MA

### System Alerts

| Alert Type | Trigger Condition | Channel | Priority |
|------------|-------------------|---------|----------|
| BTC Purchase/Sale | AI detects announcement from IR/Twitter | Telegram | High |
| New Filing | New document detected on IR page | Slack | Medium |
| Data Pending Approval | AI extraction awaiting human review | Telegram | High |
| Daily Summary | Scheduled 9am ET | Slack | Low |
| Weekly Digest | Scheduled Monday 9am ET | Slack | Low |

---

## Alert Message Templates

### Price Alert (Telegram)

```
⬆️ MSTR Price

Crossed above $350.00
Current: $362.50

210k Terminal
```

---

### mNAV Alert (Telegram)

```
⬇️ MSTR mNAV

Crossed below 1.50x
Current: 1.42x

210k Terminal
```

---

### BTC Holdings Alert (Telegram)

```
🟢 MSTR BTC Holdings

Previous      450,000
Current       478,000
Change        +28,000

210k Terminal
```

---

### Price Movement Alert (Telegram)

```
📈 MSTR +5.25%

Threshold: 5.00%

210k Terminal
```

---

### On-Chain Alert (Telegram)

```
⬆️ Fear & Greed Index

Crossed above 70
Current: 75

210k Terminal
```

---

### Daily On-Chain Digest (Telegram)

```
📊 On-Chain Brief • Jan 29

₿ $98,543

F&G       26  (Fear)
MVRV    1.12  (Fair)
NUPL     37%  (Optimism)
FR     0.01%  (Neutral)
200W    +54%  (Healthy)

210k Terminal
```

---

### Daily Summary (Slack)

```
📊 Daily Treasury Company Summary - [Date]

BTC Price: $XX,XXX (X.X% 24h)

Notable Changes:
• [Company]: mNAV X.XX → X.XX
• [Company]: +XX BTC purchased

Portfolio Value: $X.XXM (XX.X BTC)
```

---

### Weekly Digest (Slack)

```
📅 Weekly Treasury Digest - Week of [Date]

BTC Price: $XX,XXX (X.X% week)

Holdings Changes:
• [Company]: +XXX BTC (total: X,XXX)
• [Company]: +XX BTC (total: XXX)

mNAV Summary:
• Highest: [Company] at X.XX
• Lowest: [Company] at X.XX

Portfolio Performance:
• Value: $X.XXM (XX.X BTC)
• Week change: +X.X%
```

---

### AI Extraction Pending (Telegram)

```
🤖 AI EXTRACTION AWAITING REVIEW

Company: [Company Name]
Type: BTC Purchase
Confidence: XX%

Extracted Data:
• Amount: XXX BTC
• Source: [URL]

[Approve] [Edit] [Reject]
```

---

## Alert Preferences

Each Telegram user can configure:

| Setting | Options | Default |
|---------|---------|---------|
| Alert types | Multi-select | All enabled |
| Quiet hours | Start/end time | None |
| Per-company alerts | Enable/disable per company | All enabled |

---

## Notification Channels

### Telegram Recipients

| User | Chat ID | Alert Types |
|------|---------|-------------|
| Primary User | `TELEGRAM_CHAT_ID_PRIMARY` | All |
| Namcios | `TELEGRAM_CHAT_ID_NAMCIOS` | All |

### Slack Channel

Single channel receives:
- Daily summaries (9am ET)
- Weekly digests (Monday 9am ET)
- Filing alerts
- High premium alerts (mNAV > 2.0)

---

## Alert Scheduling

| Alert | Schedule | Timezone |
|-------|----------|----------|
| Daily Summary | 9:00 AM | ET |
| On-Chain Daily Digest | 9:00 AM | ET |
| Weekly Digest | Monday 9:00 AM | ET |
| Price checks | Every 15 min (market hours) | - |
| BTC price check | Every 1 min | - |
| mNAV calculation | On price update | - |
| On-Chain metric checks | Every 1 hour | - |

---

## Alert Deduplication

- Same alert type for same company: 1 hour cooldown (configurable)
- mNAV breach: Only alert once per threshold crossing (until it crosses back)
- Price move: Reset daily at midnight ET
- On-chain metric alerts: Configurable cooldown (default 60 minutes)
- On-chain daily digest: 24 hour cooldown (sends once per day)

---

## Creating On-Chain Alerts

On-chain alerts monitor Bitcoin network metrics from Bitcoin Magazine Pro API.

### Available Metrics

| Metric | Description | Typical Range |
|--------|-------------|---------------|
| Fear & Greed | Market sentiment composite | 0-100 (higher = more greedy) |
| MVRV Z-Score | Market value vs realized value | -1 to 7+ |
| NUPL | Net unrealized profit/loss | -0.5 to 1.0 |
| Funding Rate | Perpetual futures funding | -0.1% to 0.1% |
| 200 Week MA | Price premium/discount to 200W moving average | -20% to 200%+ |

---

## On-Chain Metric Interpretations

The Daily Digest and threshold alerts use these labels to provide context.

### Fear & Greed Index

| Value | Label | Interpretation |
|-------|-------|----------------|
| 80-100 | Extreme Greed | Market euphoria, potential top |
| 60-80 | Greed | Bullish sentiment |
| 40-60 | Neutral | Balanced market |
| 20-40 | Fear | Bearish sentiment |
| 0-20 | Extreme Fear | Capitulation, potential buy signal |

### MVRV Z-Score

Measures market value relative to realized value (aggregate cost basis).

| Z-Score | Label | Interpretation |
|---------|-------|----------------|
| ≥ 7 | Overvalued | Extreme overvaluation, sell zone |
| 5-7 | High | Overvalued territory |
| 3-5 | Fair+ | Fairly valued, upper range |
| 0-3 | Fair | Fairly valued, normal range |
| < 0 | Undervalued | Below cost basis, accumulation zone |

### NUPL (Net Unrealized Profit/Loss)

Shows aggregate profit/loss state of all holders.

| NUPL | Label | Interpretation |
|------|-------|----------------|
| ≥ 0.75 | Euphoria | Most holders in profit, distribution phase |
| 0.50-0.75 | Belief | Strong conviction, bull market |
| 0.25-0.50 | Optimism | Growing confidence |
| 0-0.25 | Hope | Recovery phase |
| < 0 | Capitulation | Most holders at loss, accumulation zone |

### Funding Rate

Average perpetual futures funding rate across major exchanges.

| Rate | Label | Interpretation |
|------|-------|----------------|
| ≥ 0.05% | Hot | Overleveraged longs, potential correction |
| 0.01-0.05% | Bullish | Longs paying shorts, bullish bias |
| 0-0.01% | Neutral | Balanced market |
| -0.01-0% | Bearish | Shorts paying longs |
| < -0.01% | Negative | Strong bearish bias |

### 200 Week Moving Average Premium

Distance from long-term support level.

| Premium | Label | Interpretation |
|---------|-------|----------------|
| ≥ 100% | Extended | Far above support, elevated risk |
| 50-100% | Healthy | Normal bull market range |
| 0-50% | Near Support | Closer to long-term support |
| < 0% | Below | Extremely rare, max buying opportunity |

---

## Example Alert Configurations

**Extreme Fear Alert**
- Type: `fear_greed_below`
- Threshold: 20
- Purpose: Buy signal when market is fearful

**Overvaluation Warning**
- Type: `mvrv_above`
- Threshold: 5
- Purpose: Risk alert when market is overheated

**Euphoria Alert**
- Type: `nupl_above`
- Threshold: 0.75
- Purpose: Potential top signal

**Overleveraged Longs**
- Type: `funding_rate_above`
- Threshold: 0.05
- Purpose: Warning when longs are paying high premiums

**Near Support Alert**
- Type: 200W premium (via daily digest monitoring)
- Purpose: Track when price approaches long-term support
