# System Refactoring Implementation Summary

## Overview
This implementation adds a complete 4-role permission system with full API support for managing groups, forced join channels, scheduled messages, billing, and payments.

## 1. Database Schema Updates

### New UserRole Enum
```prisma
enum UserRole {
  USER          // 普通用户 - Can join lotteries (with payment)
  VIP           // VIP用户 - Can create and join lotteries (with payment)
  ADMIN         // 管理员 - Independent bot instance (with payment)
  SUPER_ADMIN   // 超级管理员 - Full access, no payment required
}
```

### Updated User Model
Added fields:
- `role: UserRole` - User's role
- `isPaid`, `paidExpireAt` - General payment status
- `isVip`, `vipExpireAt` - VIP-specific status
- `isAdmin`, `adminExpireAt` - Admin-specific status
- Relations to new models: `UserGroup[]`, `ForcedJoinChannel[]`, `ScheduledMessage[]`, `PaymentAddress[]`

### New Models
1. **UserGroup** - Tracks groups/channels the bot/user has joined
2. **ForcedJoinChannel** - Mandatory join requirements for lottery participation
3. **ScheduledMessage** - Scheduled message delivery system
4. **PaymentAddress** - Cryptocurrency payment addresses
5. **RenewalRule** - Renewal pricing rules for different roles
6. **BillingSetting** - System billing configuration
7. **PaymentOrder** - Unified payment order system

## 2. Permission System

### File: `lib/permissions.ts`

Key functions:
- `canAccessFeature(user, feature)` - Check if user can access specific features
- `isSubscriptionValid(user)` - Check if user's payment is valid
- `getRoleDisplayName(role)` - Get localized role name

### Role-Based Access:
- **SUPER_ADMIN**: All features, no payment required
- **ADMIN**: All admin features (needs valid payment)
- **VIP**: Create and join lotteries (needs valid payment)
- **USER**: Join lotteries only (needs valid payment)

## 3. API Endpoints

### Groups Management
- `GET /api/groups` - List joined groups/channels
- `POST /api/groups` - Add group/channel
- `PUT /api/groups/[id]` - Update group/channel
- `DELETE /api/groups/[id]` - Remove group/channel

### Forced Join Management
- `GET /api/forced-join` - List forced join channels
- `POST /api/forced-join` - Add forced join requirement
- `PUT /api/forced-join/[id]` - Update forced join channel
- `DELETE /api/forced-join/[id]` - Remove forced join channel
- `POST /api/forced-join/[id]` - Toggle enabled status (action: "toggle")

### Scheduled Messages
- `GET /api/scheduled` - List scheduled messages
- `POST /api/scheduled` - Create scheduled message
- `PUT /api/scheduled/[id]` - Update scheduled message
- `DELETE /api/scheduled/[id]` - Delete scheduled message
- `POST /api/scheduled/[id]` - Cancel scheduled message (action: "cancel")

### Billing - Payment Addresses
- `GET /api/billing/address` - List payment addresses
- `POST /api/billing/address` - Add payment address
- `PUT /api/billing/address/[id]` - Update payment address
- `DELETE /api/billing/address/[id]` - Delete payment address

### Billing - Renewal Rules
- `GET /api/billing/rules` - List renewal rules
- `POST /api/billing/rules` - Add renewal rule
- `PUT /api/billing/rules/[id]` - Update renewal rule
- `DELETE /api/billing/rules/[id]` - Delete renewal rule

### Billing - Settings
- `GET /api/billing/settings` - Get billing settings (returns key-value object)
- `PUT /api/billing/settings` - Update billing settings (accepts settings object)

### Payment Orders
- `GET /api/payments` - List payment orders
- `POST /api/payments` - Create payment order
- `PUT /api/payments/[id]` - Process payment (action: "confirm" or "cancel")

## 4. Frontend Updates

### Sidebar Menu Structure
- **Super Admin Menu**: Includes all features + billing submenu with:
  - 收款地址管理 `/billing/address`
  - 续费规则管理 `/billing/rules`
  - 收费设置 `/billing/settings`
- **Admin Menu**: Core features without system management

### Updated Components
- `components/Sidebar.tsx` - Role-based menu filtering
- `hooks/useTelegramWebApp.ts` - Added role field to WebAppData

### Authentication
- `app/api/auth/telegram/route.ts` - Now returns user role

## 5. Database Migration

To apply the schema changes to your database:

```bash
# Generate Prisma Client
npm run db:generate

# Push schema changes to database
npm run db:push

# Or use migrations
npx prisma migrate dev --name add-role-permission-system
```

## 6. Environment Variables

Required environment variables remain the same:
- `DATABASE_URL` - PostgreSQL connection string
- `BOT_TOKEN` - Telegram bot token
- `SUPER_ADMIN_ID` or `SUPER_ADMIN_IDS` - Comma-separated super admin Telegram IDs

## 7. Usage Examples

### Creating a Payment Order
```typescript
const response = await fetch('/api/payments', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-telegram-init-data': initData
  },
  body: JSON.stringify({
    telegramId: '123456789',
    orderType: 'vip_purchase',
    ruleId: 'rule_id_here',
    amount: 10.00,
    currency: 'USDT'
  })
})
```

### Confirming a Payment (Super Admin Only)
```typescript
const response = await fetch('/api/payments/order_id', {
  method: 'PUT',
  headers: {
    'Content-Type': 'application/json',
    'x-telegram-init-data': initData
  },
  body: JSON.stringify({
    action: 'confirm'
  })
})
```

### Adding a Forced Join Channel
```typescript
const response = await fetch('/api/forced-join', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-telegram-init-data': initData
  },
  body: JSON.stringify({
    chatId: '-1001234567890',
    title: 'Official Channel',
    type: 'channel',
    inviteLink: 'https://t.me/+xxxxx',
    isRequired: true,
    isEnabled: true
  })
})
```

## 8. Frontend Integration (TODO)

The frontend pages already exist but need to be connected to the real APIs:

1. **Groups Page** (`app/groups/page.tsx`)
   - Use `useTelegramWebApp()` hook to get initData
   - Fetch from `/api/groups`
   - Add/edit/delete using the groups API

2. **Forced Join Page** (`app/forced-join/page.tsx`)
   - Similar to groups, connect to `/api/forced-join`

3. **Scheduled Messages** (`app/scheduled/page.tsx`)
   - Full CRUD implementation needed
   - Connect to `/api/scheduled`

4. **Billing Pages**
   - Address management: Connect to `/api/billing/address`
   - Rules management: Connect to `/api/billing/rules`
   - Settings: Connect to `/api/billing/settings`

## 9. Security Considerations

- All APIs use Telegram WebApp data validation
- Super admin endpoints check `isSuperAdmin()`
- Admin endpoints check `isAdmin()` (includes super admin)
- Payment confirmation requires super admin access
- All database operations use Prisma with parameterized queries

## 10. Testing

Build verification:
```bash
npm run build
```

Test individual APIs using curl or Postman:
```bash
# Example: Get groups (requires valid Telegram initData)
curl -H "x-telegram-init-data: YOUR_INIT_DATA" \
     https://your-domain.com/api/groups
```

## 11. Future Enhancements

- Implement frontend data fetching for all new pages
- Add Telegram webhook role-based command filtering
- Add automatic subscription expiry checking
- Implement payment gateway integration
- Add notification system for expiring subscriptions
- Add analytics and reporting for payments
