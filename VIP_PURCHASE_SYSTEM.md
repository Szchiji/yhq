# VIP Purchase System Implementation Guide

## Overview

This document describes the complete user payment purchase system that allows users to buy VIP, admin, and regular user packages through Telegram.

## System Flow

### 1. User Flow

#### Step 1: View Packages (`/vip`)
User sends `/vip` command to the bot in private chat.

**Bot Response:**
```
💎 套餐购买

👤 普通用户套餐：
  • 月度会员 - 5 USDT（30天）

⭐ VIP套餐：
  • VIP月卡 - 10 USDT（30天）
  • VIP年卡 - 80 USDT（365天）

👑 管理员套餐：
  • 管理员月卡 - 50 USDT（30天）
  • 管理员永久 - 200 USDT（永久）

点击下方按钮选择套餐：
```

With inline buttons for each package.

#### Step 2: Select Package
User clicks a package button (e.g., "VIP月卡 10USDT").

**Bot Response:**
```
💰 订单信息

套餐：VIP月卡
价格：10 USDT
权限：VIP会员
有效期：30天

📮 请转账到以下地址：
网络：TRC20
地址：TXxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

⚠️ 转账完成后，请点击「我已付款」按钮提交订单

[我已付款] [取消订单]
```

#### Step 3: Submit Payment Proof
User clicks "我已付款" button.

**Bot Response:**
```
请输入您的付款信息：

1️⃣ 发送交易哈希（TxHash）
2️⃣ 或发送付款截图

我们会在确认收款后为您开通服务。
```

User sends transaction hash or payment screenshot.

#### Step 4: Order Confirmation
**Bot Response:**
```
✅ 订单提交成功！

订单号：ORD1705056000001ABC
套餐：VIP月卡
金额：10 USDT

我们会尽快确认您的付款，请耐心等待。
确认后会自动为您开通服务。
```

### 2. Admin Flow

#### Step 1: Receive Order Notification
Super admin receives notification:

```
🔔 新订单提醒

用户：@username (123456789)
套餐：VIP月卡
金额：10 USDT
权限：VIP会员

付款凭证：TxHash: 0x123456...

[确认订单] [拒绝订单]
```

#### Step 2: Confirm or Reject

**If Confirmed:**
- User's permissions are automatically activated
- User receives confirmation message:
```
🎉 恭喜！您的订单已确认

订单号：ORD1705056000001ABC
套餐：VIP月卡
权限：VIP会员
有效期至：2026-02-12

感谢您的支持！
```

**If Rejected:**
- User receives rejection message:
```
❌ 订单未通过

订单号：ORD1705056000001ABC
原因：未收到付款或付款金额不符

如有疑问请联系管理员。
```

## Technical Architecture

### Database Schema

#### Order Model
```prisma
model Order {
  id            String    @id @default(cuid())
  orderNo       String    @unique
  userId        String
  username      String?
  firstName     String?
  ruleId        String
  ruleName      String
  amount        String
  currency      String
  targetRole    String    // user / vip / admin
  days          Int       // -1 = permanent
  paymentProof  String?
  status        String    @default("pending")
  confirmedAt   DateTime?
  confirmedBy   String?
  rejectedAt    DateTime?
  rejectReason  String?
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
}
```

#### Updated PaymentAddress Model
```prisma
model PaymentAddress {
  id          String   @id @default(cuid())
  userId      String
  user        User     @relation(fields: [userId], references: [id])
  name        String
  currency    String   @default("USDT")  // NEW FIELD
  network     String
  address     String
  qrCodeUrl   String?
  isDefault   Boolean  @default(false)
  isEnabled   Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}
```

### Core Libraries

#### lib/vipPurchase.ts
Handles the user purchase flow:
- `handleVipCommand()` - Display package list
- `handleSelectRule()` - Show payment information
- `handlePaidClick()` - Prompt for payment proof
- `handlePaymentProof()` - Create order and notify admin
- `handleCancelOrder()` - Cancel operation
- `userStates` - In-memory state management

#### lib/orderManagement.ts
Handles admin order processing:
- `handleConfirmOrder()` - Confirm order and activate permissions
- `handleRejectOrder()` - Reject order
- `notifyAdminNewOrder()` - Send order notification to admin
- `notifyUserOrderConfirmed()` - Notify user of confirmation
- `notifyUserOrderRejected()` - Notify user of rejection
- `calculateExpireAt()` - Calculate expiration dates

### Webhook Handlers

Added to `app/api/telegram/webhook/route.ts`:

1. **Command Handler:**
   - `/vip` - Show package list

2. **Callback Handlers:**
   - `buy_rule_{ruleId}` - User selects package
   - `paid_{ruleId}` - User clicks "I have paid"
   - `cancel_order` - User cancels
   - `confirm_order_{orderId}` - Admin confirms (super admin only)
   - `reject_order_{orderId}` - Admin rejects (super admin only)

3. **Message Handler:**
   - Checks user state for payment proof submission
   - Accepts text (TxHash) or photo (payment screenshot)

## Permission Activation Logic

When admin confirms an order:

### For User Role (`targetRole: 'user'`)
```typescript
await prisma.user.update({
  where: { telegramId: userId },
  data: {
    isPaid: true,
    paidExpireAt: calculateExpireAt(days)
  }
})
```

### For VIP Role (`targetRole: 'vip'`)
```typescript
await prisma.user.update({
  where: { telegramId: userId },
  data: {
    isVip: true,
    vipExpireAt: calculateExpireAt(days)
  }
})
```

### For Admin Role (`targetRole: 'admin'`)
```typescript
// Create/update Admin record
await prisma.admin.upsert({
  where: { telegramId: userId },
  create: {
    telegramId: userId,
    username: user.username,
    firstName: user.firstName,
    lastName: user.lastName,
    isActive: true,
    createdBy: adminId
  },
  update: {
    isActive: true
  }
})

// Update User record
await prisma.user.update({
  where: { telegramId: userId },
  data: {
    isAdmin: true,
    adminExpireAt: calculateExpireAt(days)
  }
})
```

## Configuration Requirements

### Environment Variables
- `BOT_TOKEN` - Telegram bot token
- `SUPER_ADMIN_ID` - Telegram ID of super admin (receives order notifications)

### Database Setup

1. Add package configurations to `RenewalRule` table:
```sql
INSERT INTO "RenewalRule" (id, name, targetRole, days, price, currency, isEnabled, sortOrder)
VALUES 
  ('rule1', '月度会员', 'user', 30, 5.00, 'USDT', true, 1),
  ('rule2', 'VIP月卡', 'vip', 30, 10.00, 'USDT', true, 2),
  ('rule3', 'VIP年卡', 'vip', 365, 80.00, 'USDT', true, 3),
  ('rule4', '管理员月卡', 'admin', 30, 50.00, 'USDT', true, 4),
  ('rule5', '管理员永久', 'admin', -1, 200.00, 'USDT', true, 5);
```

2. Add payment addresses to `PaymentAddress` table:
```sql
INSERT INTO "PaymentAddress" (id, userId, name, currency, network, address, isEnabled)
VALUES 
  ('addr1', 'system_user_id', 'USDT收款', 'USDT', 'TRC20', 'TXxxxxxxxxxxxxxxxxxxxxx', true);
```

## User State Management

The system uses an in-memory Map to track user states during payment proof submission:

```typescript
userStates.set(userId, { 
  state: 'waiting_payment_proof', 
  data: { ruleId: 'xxx' } 
})
```

**Limitations:**
- State is lost on server restart
- Not suitable for multi-instance deployments
- Consider using Redis for production deployments

## Order Number Generation

Format: `ORD{timestamp}{random}`

Example: `ORD1705056000001ABC`

- `ORD` - Prefix
- `1705056000001` - Unix timestamp in milliseconds
- `ABC` - Random 4-character suffix (uppercase)

This format prevents collisions in normal usage scenarios.

## Security Considerations

1. **Admin Verification**: Only super admins can confirm/reject orders
2. **State Validation**: All operations verify order status before processing
3. **SQL Injection**: Prevented by Prisma ORM
4. **XSS**: Not applicable (Telegram API handles rendering)

## Testing Checklist

- [ ] User can view package list with `/vip`
- [ ] User can select a package
- [ ] Payment address is displayed correctly
- [ ] User can submit payment proof (text)
- [ ] User can submit payment proof (photo)
- [ ] Order is created in database
- [ ] Admin receives notification
- [ ] Admin can confirm order
- [ ] User permissions are activated correctly
- [ ] User receives confirmation message
- [ ] Admin can reject order
- [ ] User receives rejection message
- [ ] User can cancel before submitting proof

## Troubleshooting

### Issue: Payment address not showing
**Solution:** Ensure `PaymentAddress` record exists with matching `currency` and `isEnabled: true`

### Issue: Admin not receiving notifications
**Solution:** Verify `SUPER_ADMIN_ID` environment variable is set correctly

### Issue: User state lost after server restart
**Solution:** This is expected with in-memory storage. User can restart flow by sending `/vip` again.

### Issue: Order number collision
**Solution:** Very unlikely with current implementation (timestamp + random suffix)

## Future Enhancements

1. **Persistent State Storage**: Use Redis or database for user states
2. **Photo Download**: Store actual payment screenshots instead of file IDs
3. **Custom Rejection Reasons**: Allow admins to specify rejection reasons
4. **Order History**: Add user interface to view order history
5. **Automatic Verification**: Integrate blockchain APIs for automatic payment verification
6. **Multi-Currency Support**: Support multiple cryptocurrencies
7. **Refund System**: Add refund handling for rejected orders
8. **Notification Preferences**: Allow admins to configure notification channels

## API Reference

### Public Functions (lib/vipPurchase.ts)

#### handleVipCommand(chatId: string, userId: string)
Displays the package list to the user.

#### handleSelectRule(chatId: string, userId: string, ruleId: string, callbackQueryId: string)
Shows payment information for selected package.

#### handlePaidClick(chatId: string, userId: string, ruleId: string, callbackQueryId: string)
Prompts user to submit payment proof.

#### handlePaymentProof(chatId: string, userId: string, username: string | undefined, firstName: string | undefined, proof: string, ruleId: string)
Creates order and notifies admin.

#### handleCancelOrder(chatId: string, callbackQueryId: string)
Cancels the current operation.

### Public Functions (lib/orderManagement.ts)

#### handleConfirmOrder(chatId: string, adminId: string, orderId: string, callbackQueryId: string)
Confirms order and activates user permissions.

#### handleRejectOrder(chatId: string, adminId: string, orderId: string, callbackQueryId: string)
Rejects order and notifies user.

#### notifyAdminNewOrder(order: any, username: string | undefined, firstName: string | undefined)
Sends order notification to super admin.

## Maintenance

### Database Migration
When deploying, run:
```bash
npx prisma db push
```

### Monitoring
Monitor these metrics:
- Order creation rate
- Confirmation/rejection rate
- Average confirmation time
- Failed order notifications

### Backup
Ensure regular backups of the `Order` table to prevent data loss.
