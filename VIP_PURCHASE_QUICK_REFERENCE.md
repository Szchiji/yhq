# VIP 购买系统快速参考

## 命令

### 用户命令
- `/vip` - 查看套餐列表并购买

## 系统流程

### 用户购买流程

1. **发送 `/vip`** → 查看套餐列表
2. **选择套餐** → 显示付款信息
3. **点击「我已付款」** → 提示输入凭证
4. **发送 TxHash 或截图** → 创建订单
5. **等待管理员确认** → 自动开通权限

### 管理员审核流程

1. **接收订单通知** → 查看用户信息和付款凭证
2. **点击「确认订单」** → 自动开通用户权限
3. **点击「拒绝订单」** → 通知用户订单未通过

## 数据库表

### Order（订单表）
```
- orderNo: 订单号（唯一）
- userId: 用户 Telegram ID
- ruleId: 套餐规则 ID
- amount: 金额
- currency: 货币（USDT）
- targetRole: 目标角色（user/vip/admin）
- days: 天数（-1 表示永久）
- paymentProof: 付款凭证
- status: 状态（pending/confirmed/rejected）
```

### RenewalRule（续费规则）
配置可购买的套餐：
```
- name: 套餐名称
- targetRole: 目标角色
- days: 有效天数
- price: 价格
- currency: 货币
- isEnabled: 是否启用
```

### PaymentAddress（收款地址）
配置收款地址：
```
- name: 地址名称
- currency: 货币类型
- network: 网络（TRC20/ERC20等）
- address: 收款地址
- isEnabled: 是否启用
```

## 权限开通逻辑

### 普通用户（targetRole: user）
```
isPaid = true
paidExpireAt = 当前时间 + days 天
```

### VIP用户（targetRole: vip）
```
isVip = true
vipExpireAt = 当前时间 + days 天
```

### 管理员（targetRole: admin）
```
创建/更新 Admin 记录
isAdmin = true
adminExpireAt = 当前时间 + days 天
```

### 永久权限（days = -1）
```
expireAt = 2099-12-31
```

## 环境变量配置

```env
BOT_TOKEN=your_telegram_bot_token
SUPER_ADMIN_ID=admin_telegram_id
DATABASE_URL=your_database_url
```

## 初始数据设置

### 1. 添加续费规则
通过管理后台 `/billing/rules` 添加套餐，或直接插入数据：

```sql
-- 普通用户月卡
INSERT INTO "RenewalRule" (name, targetRole, days, price, currency, isEnabled)
VALUES ('月度会员', 'user', 30, 5.00, 'USDT', true);

-- VIP 月卡
INSERT INTO "RenewalRule" (name, targetRole, days, price, currency, isEnabled)
VALUES ('VIP月卡', 'vip', 30, 10.00, 'USDT', true);

-- VIP 年卡
INSERT INTO "RenewalRule" (name, targetRole, days, price, currency, isEnabled)
VALUES ('VIP年卡', 'vip', 365, 80.00, 'USDT', true);

-- 管理员月卡
INSERT INTO "RenewalRule" (name, targetRole, days, price, currency, isEnabled)
VALUES ('管理员月卡', 'admin', 30, 50.00, 'USDT', true);

-- 管理员永久
INSERT INTO "RenewalRule" (name, targetRole, days, price, currency, isEnabled)
VALUES ('管理员永久', 'admin', -1, 200.00, 'USDT', true);
```

### 2. 添加收款地址
通过管理后台 `/billing/address` 添加地址，或直接插入：

```sql
-- 需要先有一个管理员用户
INSERT INTO "PaymentAddress" (userId, name, currency, network, address, isEnabled)
VALUES (
  'your_admin_user_id',
  'USDT-TRC20收款地址',
  'USDT',
  'TRC20',
  'TXxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
  true
);
```

## 常见问题

### Q: 用户看不到套餐列表？
A: 检查 RenewalRule 表中是否有 `isEnabled = true` 的记录

### Q: 没有显示收款地址？
A: 检查 PaymentAddress 表中是否有对应货币且 `isEnabled = true` 的记录

### Q: 管理员收不到订单通知？
A: 检查 `SUPER_ADMIN_ID` 环境变量是否配置正确

### Q: 确认订单后权限没开通？
A: 检查目标角色是否正确，查看服务器日志

### Q: 服务器重启后用户状态丢失？
A: 正常现象，用户重新发送 `/vip` 即可继续流程

## 文件结构

```
lib/
  ├── vipPurchase.ts        # 用户购买流程
  └── orderManagement.ts    # 订单管理和权限开通

app/api/telegram/webhook/
  └── route.ts              # Webhook 处理器（已更新）

prisma/
  └── schema.prisma         # 数据库模型（已更新）
```

## 回调数据格式

```
buy_rule_{ruleId}         # 选择套餐
paid_{ruleId}             # 我已付款
cancel_order              # 取消订单
confirm_order_{orderId}   # 确认订单（管理员）
reject_order_{orderId}    # 拒绝订单（管理员）
```

## 订单状态

- `pending` - 待确认
- `confirmed` - 已确认
- `rejected` - 已拒绝

## 消息模板

所有用户消息和管理员通知的文案都在代码中定义，可以在以下文件中修改：

- `lib/vipPurchase.ts` - 用户端消息
- `lib/orderManagement.ts` - 管理员和通知消息

## 测试步骤

1. ✅ 配置环境变量
2. ✅ 运行数据库迁移 `npx prisma db push`
3. ✅ 添加续费规则
4. ✅ 添加收款地址
5. ✅ 测试 `/vip` 命令
6. ✅ 测试完整购买流程
7. ✅ 测试管理员确认
8. ✅ 测试管理员拒绝

## 性能注意事项

- 用户状态存储在内存中，不持久化
- 单实例部署推荐，多实例需要使用 Redis
- 订单号使用时间戳+随机字符，避免高并发冲突

## 安全性

- ✅ 仅超级管理员可确认/拒绝订单
- ✅ 所有数据库操作使用 Prisma ORM，防止 SQL 注入
- ✅ 订单状态验证，防止重复处理
- ✅ 用户输入经过验证

## 维护建议

- 定期备份 Order 表数据
- 监控订单处理时间
- 定期清理已处理的旧订单（可选）
- 监控失败的通知发送
