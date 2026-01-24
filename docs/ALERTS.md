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

| Alert Type | Trigger Condition | Channel | Priority |
|------------|-------------------|---------|----------|
| BTC Purchase/Sale | AI detects announcement from IR/Twitter | Telegram | High |
| mNAV Breach | mNAV crosses configured threshold | Telegram | High |
| Large Price Move | > 5% daily change | Telegram | Medium |
| New Filing | New document detected on IR page | Slack | Medium |
| Data Pending Approval | AI extraction awaiting human review | Telegram | High |
| Daily Summary | Scheduled 9am ET | Slack | Low |
| Weekly Digest | Scheduled Monday 9am ET | Slack | Low |

---

## Alert Message Templates

### BTC Purchase Alert (Telegram)

```
🟢 BTC PURCHASE DETECTED

[Company Name] has announced a Bitcoin purchase.

Amount: +XXX BTC
New Total: X,XXX BTC
Source: [IR/Twitter]

[Approve] [Review] [Dismiss]
```

---

### mNAV Breach Alert (Telegram)

```
⚠️ mNAV THRESHOLD BREACH

[Company Name] mNAV crossed [threshold]

Current mNAV: X.XX
Previous: X.XX (Xh ago)
Change: +XX%

[View Dashboard]
```

---

### Large Price Move Alert (Telegram)

```
📈 SIGNIFICANT PRICE MOVE

[Company Name] ([Ticker])

Price: $XX.XX
Change: +X.X% (24h)
mNAV: X.XX

[View Dashboard]
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
| Weekly Digest | Monday 9:00 AM | ET |
| Price checks | Every 15 min (market hours) | - |
| BTC price check | Every 1 min | - |
| mNAV calculation | On price update | - |

---

## Alert Deduplication

- Same alert type for same company: 1 hour cooldown
- mNAV breach: Only alert once per threshold crossing (until it crosses back)
- Price move: Reset daily at midnight ET
