# Database Initialization

## Overview

This document describes how to initialize the database with default settings and commands.

## Problem

After deploying the application or migrating the database schema, the following tables might be empty:
- `SystemSetting` - Required for bot behavior configuration
- `BotCommand` - Required for Telegram command menu

Without these records, the bot may not respond to commands like `/start`, `/bot`, etc.

## Solution

We've added database initialization functionality that can be triggered via API endpoint.

## API Endpoints

### GET /api/init

Check the database initialization status.

**Request:**
```bash
curl https://your-domain.com/api/init
```

**Response:**
```json
{
  "ok": true,
  "initialized": true,
  "settingsCount": 3,
  "commandsCount": 5
}
```

### POST /api/init

Initialize the database with default settings and commands. Requires super admin authentication.

**Request:**
```bash
curl -X POST "https://your-domain.com/api/init?telegramId=YOUR_TELEGRAM_ID"
```

Or with Authorization header:
```bash
curl -X POST https://your-domain.com/api/init \
  -H "Authorization: Bearer YOUR_TELEGRAM_ID"
```

**Response:**
```json
{
  "ok": true,
  "success": true,
  "message": "Database initialized successfully"
}
```

## What Gets Initialized

### System Settings

- `lottery_limit_enabled`: `false` - Whether to limit lottery participation
- `lottery_daily_limit`: `3` - Daily participation limit for non-VIP users
- `vip_unlimited`: `true` - Whether VIP users have unlimited access

### Bot Commands

- `/start` - Start using the bot
- `/new` - Create a new lottery
- `/mylottery` - View my lotteries
- `/vip` - View VIP status
- `/bot` - Open admin dashboard

## Automatic Initialization

The initialization can also be performed programmatically:

```typescript
import { initDatabase } from '@/lib/init'

await initDatabase()
```

## Health Check

The webhook endpoint now includes a health check:

**Request:**
```bash
curl https://your-domain.com/api/telegram/webhook
```

**Response:**
```json
{
  "ok": true,
  "message": "Webhook is active",
  "timestamp": "2026-01-10T12:40:40.794Z"
}
```

## Troubleshooting

If the bot is not responding to commands:

1. Check webhook health: `GET /api/telegram/webhook`
2. Check database status: `GET /api/init`
3. If not initialized, run initialization: `POST /api/init?telegramId=YOUR_ID`
4. Check logs for detailed error messages

## Environment Variables

Make sure these environment variables are set:

- `SUPER_ADMIN_IDS` or `SUPER_ADMIN_ID` - Required for POST /api/init
- `BOT_TOKEN` - Required for webhook to work
- `DATABASE_URL` - Required for database operations
