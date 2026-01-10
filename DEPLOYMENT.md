# Deployment Guide - System Complete Upgrade

## 🎯 Overview

This guide will help you deploy the comprehensive system upgrade that includes VIP membership, system settings, command management, and more.

## 📋 Pre-Deployment Checklist

- [ ] Review all changes in the PR
- [ ] Backup your database
- [ ] Update environment variables
- [ ] Test in staging environment (if available)

## 🔧 Environment Variables Update

### Required Changes

Update your `.env` or environment configuration:

```env
# OLD (Remove or keep for backward compatibility)
SUPER_ADMIN_ID=123456789

# NEW (Add these)
SUPER_ADMIN_IDS=123456789,987654321  # Comma-separated list
BOT_USERNAME=your_bot_username       # Your bot's username without @

# Existing (Keep these)
BOT_TOKEN=your_bot_token
DATABASE_URL=your_database_url
WEBAPP_URL=your_webapp_url
```

### How to Get Values

**SUPER_ADMIN_IDS:**
- Message @userinfobot on Telegram
- Copy your user ID
- Add multiple IDs separated by commas (no spaces)

**BOT_USERNAME:**
- Open your bot in Telegram
- Copy the username (without @ symbol)
- Example: If bot is @lottery_bot, use `lottery_bot`

## 🗄️ Database Migration

### Step 1: Generate Prisma Client

```bash
npx prisma generate
```

### Step 2: Apply Schema Changes

```bash
npx prisma db push
```

This will create the following new tables:
- `VipPlan` - VIP membership plans
- `VipOrder` - VIP purchase orders
- `SystemSetting` - System configuration
- `BotCommand` - Bot commands (already exists, enhanced)
- `AnnouncementChannel` - Broadcast channels (already exists)

And add these fields to `User` table:
- `dailyJoinCount` - Track daily participation
- `dailyJoinResetAt` - Auto-reset timestamp

### Step 3: Verify Migration

```bash
npx prisma studio
```

Check that all new tables exist and are empty.

## 🤖 Telegram Bot Configuration

### Update Bot Commands

After deployment, sync commands to Telegram:

1. **Via Admin Panel** (Recommended):
   - Go to `/commands` page
   - Commands will auto-sync when you save changes

2. **Manual Sync** (If needed):
```bash
curl -X POST "https://api.telegram.org/bot<BOT_TOKEN>/setMyCommands" \
  -H "Content-Type: application/json" \
  -d '{
    "commands": [
      {"command": "start", "description": "开始使用机器人"},
      {"command": "new", "description": "网页创建抽奖"},
      {"command": "create", "description": "机器人创建抽奖"},
      {"command": "newinvite", "description": "创建邀请类型抽奖"},
      {"command": "mylottery", "description": "我发起的抽奖"},
      {"command": "vip", "description": "VIP会员"}
    ]
  }'
```

## 🚀 Deployment Steps

### For Railway

1. **Update Environment Variables**:
   - Go to Railway project → Settings → Variables
   - Add/update the environment variables listed above

2. **Trigger Deployment**:
   - Push to your connected branch
   - Or manually trigger redeploy in Railway dashboard

3. **Apply Database Migration**:
```bash
railway run npx prisma db push
```

4. **Verify Deployment**:
   - Open your webapp URL
   - Login as super admin
   - Check that new pages load correctly

### For Other Platforms

1. Update environment variables in your platform's dashboard
2. Deploy the new code
3. Run database migration:
```bash
npx prisma db push
```

## ✅ Post-Deployment Verification

### 1. Access Admin Panel

1. Open Telegram and message your bot
2. Send `/start` command
3. Verify you see the updated command menu
4. Send `/bot` command to open admin panel

### 2. Check New Pages

Verify these pages load correctly:

**Super Admin:**
- [ ] `/vip-plans` - VIP Plans Management
- [ ] `/orders` - Orders Management
- [ ] `/settings` - System Settings
- [ ] `/commands` - Command Management
- [ ] `/announcements` - Announcement Channels

**All Admins:**
- [ ] `/users` - Enhanced with VIP management
- [ ] All existing pages still work

### 3. Test VIP System

1. Go to `/vip-plans`
2. Create a test VIP plan:
   - Name: "Test Monthly"
   - Days: 30
   - Price: 1
   - Currency: USDT

3. Open Telegram bot
4. Send `/vip` command
5. Verify you see:
   - Your current VIP status
   - The test plan as a button

6. Click the plan button
7. Verify order is created in `/orders` page

### 4. Test System Settings

1. Go to `/settings`
2. Enable daily participation limit
3. Set limit to 3
4. Save settings
5. Test with a user account (create new or use test account):
   - Participate in 3 lotteries
   - 4th participation should be blocked with clear message

### 5. Test Command Management

1. Go to `/commands`
2. Default commands should be listed
3. Try toggling a command on/off
4. Check Telegram to verify command menu updates

## 🔍 Troubleshooting

### Issue: Pages not loading

**Solution:**
- Clear browser cache
- Check browser console for errors
- Verify environment variables are set correctly

### Issue: Database connection error

**Solution:**
- Verify `DATABASE_URL` is correct
- Check database is running
- Run `npx prisma generate` again

### Issue: VIP system not working

**Solution:**
- Check that VipPlan and VipOrder tables exist
- Verify Prisma client was regenerated
- Check API route logs for errors

### Issue: Commands not syncing

**Solution:**
- Verify `BOT_TOKEN` is correct
- Check that bot has proper permissions
- Try manual sync using curl command above

### Issue: Multi-admin not working

**Solution:**
- Verify `SUPER_ADMIN_IDS` format (comma-separated, no spaces)
- Check that IDs are numeric strings
- Restart the application after environment change

## 📊 Monitoring

### Key Metrics to Watch

1. **VIP Orders**: Monitor `/orders` page for new orders
2. **User Limits**: Check if daily limits are working correctly
3. **Command Usage**: Track which commands users use most
4. **Error Logs**: Watch for any API errors

### Health Check

Run these checks weekly:

```bash
# Check database connection
npx prisma studio

# Check for failed migrations
npx prisma migrate status

# View logs (adjust for your platform)
railway logs
```

## 🎉 Success Indicators

You'll know the deployment was successful when:

- ✅ All new pages load without errors
- ✅ VIP command works in Telegram
- ✅ Command menu shows all commands
- ✅ System settings can be changed
- ✅ Orders can be created and confirmed
- ✅ Daily limits work correctly
- ✅ Multi-admin login works

## 🆘 Rollback Plan

If you need to rollback:

1. **Via Git**:
```bash
git revert aeb3875  # Use the actual commit hash
git push
```

2. **Environment Variables**:
   - Restore old `SUPER_ADMIN_ID`
   - Remove new variables

3. **Database**:
   - If needed, restore from backup
   - New tables won't break old code

## 📞 Support

If you encounter issues:

1. Check the troubleshooting section above
2. Review error logs in your platform dashboard
3. Check browser console for client-side errors
4. Verify all environment variables are correct

## 🎊 Enjoy Your Upgraded System!

Your lottery bot management system now has:
- 💎 Complete VIP monetization
- ⚙️ Flexible system settings
- 🤖 Command management
- 📢 Announcement channels
- 👥 Enhanced user management
- 🎯 Role-based access control

Happy managing! 🚀
