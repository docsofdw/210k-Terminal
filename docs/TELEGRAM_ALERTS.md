# Telegram Alerts System

This document describes the complete Telegram alerts integration for 210k Terminal.

---

## Overview

The alert system allows users to receive instant notifications via Telegram when:
- Stock prices cross thresholds
- mNAV values exceed limits
- BTC holdings change
- Significant price movements occur

---

## Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   User creates  │────▶│  Alert stored in │────▶│  Cron job runs  │
│   alert in UI   │     │    database      │     │  every 5 mins   │
└─────────────────┘     └──────────────────┘     └────────┬────────┘
                                                          │
                                                          ▼
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  User receives  │◀────│  Telegram API    │◀────│ checkAllAlerts  │
│  notification   │     │  sendMessage     │     │ triggers alert  │
└─────────────────┘     └──────────────────┘     └─────────────────┘
```

---

## Telegram Bot Setup

### Bot Details
- **Bot Name:** 210k Terminal Alerts
- **Bot Username:** @terminal210k_bot
- **Bot URL:** https://t.me/terminal210k_bot

### Creating a New Bot (if needed)
1. Message @BotFather on Telegram
2. Send `/newbot`
3. Follow prompts to name the bot
4. Save the bot token (format: `123456789:ABCdefGHI...`)

### Setting Up the Webhook
The webhook allows the bot to respond to user messages (like /start).

```bash
# Set webhook URL
curl -X POST "https://api.telegram.org/bot<BOT_TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://your-domain.com/api/telegram-webhook"}'

# Verify webhook is set
curl "https://api.telegram.org/bot<BOT_TOKEN>/getWebhookInfo"
```

---

## Environment Variables

### Required for Production (Vercel)
```env
TELEGRAM_BOT_TOKEN=your_bot_token_from_botfather
TELEGRAM_CHAT_ID_PRIMARY=your_chat_id
```

### Required for Local Development (.env.local)
```env
TELEGRAM_BOT_TOKEN=your_bot_token_from_botfather
TELEGRAM_CHAT_ID_PRIMARY=your_chat_id
```

### Variable Descriptions
| Variable | Description |
|----------|-------------|
| `TELEGRAM_BOT_TOKEN` | Bot token from @BotFather |
| `TELEGRAM_CHAT_ID_PRIMARY` | Default chat ID for alerts (fallback if user hasn't connected) |

---

## User Connection Flow

### How Users Connect Telegram

1. **User visits Alerts page** (`/dashboard/alerts`)
2. **Sees "Connect Telegram" card** (if not connected)
3. **Clicks "Open Bot"** → Opens https://t.me/terminal210k_bot
4. **Sends /start to bot** → Bot replies with their Chat ID
5. **Pastes Chat ID** in the input field
6. **Clicks Connect** → API sends test message to verify
7. **Success** → Chat ID saved to `customers.telegramChatId`

### Database Schema
```sql
-- customers table fields for Telegram
telegram_chat_id TEXT,           -- User's Telegram chat ID
telegram_username TEXT,          -- Optional: Telegram username
telegram_connected_at TIMESTAMP  -- When they connected
```

### API Endpoint
```
POST /api/connect-telegram
Body: { "chatId": "your_chat_id" }

Response (success): { "success": true }
Response (error): { "error": "Could not send test message" }
```

---

## Bot Webhook Commands

The bot responds to these commands via `/api/telegram-webhook`:

| Command | Response |
|---------|----------|
| `/start` | Welcome message with Chat ID |
| `/chatid` or `/id` | Just the Chat ID |
| `/help` | List of available commands |

### Webhook Endpoint
```
POST /api/telegram-webhook

Receives Telegram updates, parses commands, sends responses.
```

---

## Alert Types

### 1. Price Above / Price Below
Triggers when stock price crosses a threshold.

```
⬆️ PRICE ALERT

Moon Inc (1723.HK)

Price crossed above your threshold

━━━━━━━━━━━━━━━
📊 Current:    HKD 1.31
🎯 Threshold:  HKD 0.30
━━━━━━━━━━━━━━━

210k Terminal
```

**Note:** Price alerts use LOCAL currency (HKD, JPY, etc.), not USD.

### 2. mNAV Above / mNAV Below
Triggers when mNAV crosses a threshold.

```
⬇️ mNAV ALERT

MicroStrategy (MSTR)

mNAV crossed below your threshold

━━━━━━━━━━━━━━━
📊 Current:    1.85x
🎯 Threshold:  2.00x
━━━━━━━━━━━━━━━

210k Terminal
```

### 3. BTC Holdings Change
Triggers when a company's BTC holdings change.

```
🟢 BTC HOLDINGS UPDATE

Strategy (MSTR)

━━━━━━━━━━━━━━━
📊 Previous:  450,000 BTC
📊 Current:   478,000 BTC
📈 Change:    +28,000 BTC
━━━━━━━━━━━━━━━

210k Terminal
```

### 4. Percentage Change
Triggers on significant price movements.

```
📈 PRICE MOVEMENT

Metaplanet (3350.T)

Significant price movement detected

━━━━━━━━━━━━━━━
📊 Change:     +12.50%
🎯 Threshold:  10.00%
━━━━━━━━━━━━━━━

210k Terminal
```

---

## Alert Processing

### Cron Job
- **Endpoint:** `/api/cron/check-alerts`
- **Schedule:** Every 5 minutes (`*/5 * * * *`)
- **Authentication:** Requires `CRON_SECRET` bearer token

### How Alerts Are Checked

```typescript
// Simplified flow in checkAllAlerts()
1. Fetch all active alerts with company data
2. Fetch latest BTC price, stock prices, FX rates
3. For each alert:
   a. Get current stock price (local currency)
   b. Calculate mNAV if needed
   c. Compare against threshold
   d. If triggered, call triggerAlert()
4. Return summary { checked, triggered, errors }
```

### Cooldown System
- Each alert has a `cooldownMinutes` setting (default: 60)
- After triggering, alert won't trigger again until cooldown expires
- Prevents notification spam

### Alert Status Flow
```
active → (triggered) → active (if repeating) or triggered (if one-time)
active → paused (manual) → active (manual)
```

---

## Key Files

| File | Purpose |
|------|---------|
| `actions/alerts.ts` | Alert CRUD, checkAllAlerts, triggerAlert |
| `actions/user.ts` | connectTelegram, disconnectTelegram |
| `lib/notifications/telegram.ts` | sendTelegramMessage helper |
| `app/api/telegram-webhook/route.ts` | Bot command handler |
| `app/api/connect-telegram/route.ts` | User connection endpoint |
| `app/api/cron/check-alerts/route.ts` | Alert checking cron |
| `db/schema/alerts.ts` | Alert table schema |
| `db/schema/alert-history.ts` | Alert trigger history |
| `db/schema/customers.ts` | User Telegram fields |

---

## Quick Setup Checklist

### For Admins (Initial Setup)
- [ ] Create Telegram bot via @BotFather
- [ ] Add `TELEGRAM_BOT_TOKEN` to Vercel env vars
- [ ] Add `TELEGRAM_CHAT_ID_PRIMARY` as fallback
- [ ] Set webhook URL via Telegram API
- [ ] Verify cron job is running in Vercel

### For New Users
- [ ] Go to Alerts page
- [ ] Click "Open Bot" to open Telegram
- [ ] Send /start to get Chat ID
- [ ] Paste Chat ID and click Connect
- [ ] Create alerts using templates or custom

---

## Troubleshooting

### "Telegram bot not configured"
- Check `TELEGRAM_BOT_TOKEN` is set in environment
- For local dev: add to `.env.local`
- For production: add to Vercel env vars

### "Could not send test message"
- User may not have messaged the bot first
- Chat ID might be incorrect
- Bot token might be invalid

### Alerts not triggering
- Check cron job is running (Vercel dashboard → Crons)
- Verify alert status is "active"
- Check cooldown hasn't blocked re-trigger
- Verify stock price data is being fetched

### Bot not responding to /start
- Check webhook is set correctly
- Verify `/api/telegram-webhook` endpoint is deployed
- Check Vercel function logs for errors

---

## Testing

### Manual Alert Check
```bash
curl -X GET "https://your-domain.com/api/cron/check-alerts" \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

### Send Test Message
```bash
curl -X POST "https://api.telegram.org/bot<TOKEN>/sendMessage" \
  -H "Content-Type: application/json" \
  -d '{"chat_id": "CHAT_ID", "text": "Test message", "parse_mode": "HTML"}'
```

### Check Webhook Status
```bash
curl "https://api.telegram.org/bot<TOKEN>/getWebhookInfo"
```

---

## Security Notes

1. **Never commit bot tokens** - Use environment variables
2. **Validate chat IDs** - Only accept numeric values
3. **Verify user ownership** - Users can only manage their own alerts
4. **Cron authentication** - All cron endpoints require `CRON_SECRET`
5. **Rate limiting** - Cooldown prevents alert spam
