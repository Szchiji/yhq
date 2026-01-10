# Quick Reference - Bot Not Responding Fix

## Quick Diagnosis

```bash
# 1. Check webhook health
curl https://your-domain.com/api/telegram/webhook

# 2. Check database status
curl https://your-domain.com/api/init

# 3. Check logs
# Look for: "Webhook received:", "Error handling /start:", "Webhook error:"
```

## Quick Fix

```bash
# Initialize database (requires super admin)
curl -X POST "https://your-domain.com/api/init?telegramId=YOUR_TELEGRAM_ID"
```

## Expected Responses

### Healthy Webhook
```json
{
  "ok": true,
  "message": "Webhook is active",
  "timestamp": "2026-01-10T12:40:40.794Z"
}
```

### Initialized Database
```json
{
  "ok": true,
  "initialized": true,
  "settingsCount": 3,
  "commandsCount": 5
}
```

### Successful Initialization
```json
{
  "ok": true,
  "success": true,
  "message": "Database initialized successfully"
}
```

## Common Issues & Solutions

| Issue | Solution |
|-------|----------|
| Bot doesn't respond to /start | Run initialization endpoint |
| Webhook returns 500 | Check logs, deploy latest changes |
| Database not initialized | Run POST /api/init |
| Auth error on initialization | Verify SUPER_ADMIN_IDS env var |

## Environment Variables Required

```bash
BOT_TOKEN=your_bot_token
SUPER_ADMIN_IDS=telegram_id1,telegram_id2
DATABASE_URL=postgresql://...
WEBAPP_URL=https://your-domain.com
```

## Test Commands in Telegram

After initialization, test these commands:
1. `/start` - Should show welcome message
2. `/bot` - Should prompt to open admin panel (admin only)
3. `/vip` - Should show VIP status
4. `/new` - Should prompt to create lottery (admin only)
5. `/mylottery` - Should show lottery list (admin only)

## Error Messages Explained

| Log Message | Meaning | Action |
|-------------|---------|--------|
| "Webhook received: {..." | Normal operation | None |
| "Error handling /start:" | /start command failed | Check database |
| "Failed to send fallback message:" | Critical - sendMessage failed | Check BOT_TOKEN |
| "Error getting setting:" | Database query failed | Initialize database |
| "Error initializing database:" | Init failed | Check DATABASE_URL |

## Rollback Plan

If issues persist after deployment:

```bash
# 1. Check previous working version
git log --oneline

# 2. Revert to previous commit
git revert HEAD

# 3. Redeploy
```

## Support

For more details, see:
- `DATABASE_INIT.md` - Full initialization guide
- `IMPLEMENTATION_SUMMARY.md` - Technical details
- Application logs - Real-time debugging

## Quick Commands Cheat Sheet

```bash
# Health check
curl https://your-domain.com/api/telegram/webhook

# Status check
curl https://your-domain.com/api/init

# Initialize (super admin only)
curl -X POST "https://your-domain.com/api/init?telegramId=YOUR_ID"

# With auth header
curl -X POST https://your-domain.com/api/init \
  -H "Authorization: Bearer YOUR_TELEGRAM_ID"

# Check Telegram webhook info
curl "https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo"

# Set webhook (if needed)
curl "https://api.telegram.org/bot${BOT_TOKEN}/setWebhook?url=https://your-domain.com/api/telegram/webhook"
```
