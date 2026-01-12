# 过期提醒功能部署指南

## 功能概述

当用户的 VIP/管理员/会员权限即将过期时，系统会自动发送续费提醒消息。

## 数据库迁移

部署后需要运行数据库迁移：

```bash
npx prisma db push
```

这将创建以下新表：
- `ReminderSetting` - 提醒设置
- `ReminderLog` - 提醒发送记录（防重复）

## 环境变量配置

需要添加以下环境变量：

```env
CRON_SECRET=your_secure_random_string_here
```

建议使用强随机字符串，例如：
```bash
openssl rand -hex 32
```

## 定时任务配置

### 使用 Railway Cron

在 Railway 中配置定时任务：

1. 访问 Railway 项目设置
2. 添加 Cron Job
3. 配置：
   - **Schedule**: `0 9 * * *` (每天早上 9:00)
   - **URL**: `https://your-domain.com/api/cron/reminders`
   - **Method**: GET
   - **Headers**: 
     ```
     Authorization: Bearer ${CRON_SECRET}
     ```

### 使用外部 Cron 服务

可以使用以下服务：
- [cron-job.org](https://cron-job.org)
- [EasyCron](https://www.easycron.com)
- [Cronitor](https://cronitor.io)

配置示例（cron-job.org）：
1. 创建新任务
2. URL: `https://your-domain.com/api/cron/reminders`
3. 执行时间: 每天 9:00
4. HTTP 方法: GET
5. 请求头: `Authorization: Bearer ${CRON_SECRET}`

## 功能使用

### 访问设置页面

超级管理员可以通过以下路径访问：
- 侧边栏 → 系统设置 → 过期提醒设置
- 直接访问: `/settings/reminders`

### 配置选项

1. **启用/禁用** - 控制提醒功能开关
2. **提醒天数** - 可多选：7天、5天、3天、2天、1天
3. **消息模板** - 分别配置 VIP、管理员、普通用户的提醒模板

### 支持的模板变量

- `{daysLeft}` - 剩余天数
- `{type}` - 权限类型（VIP/管理员/会员）

### 测试功能

点击"手动触发测试"按钮可以立即执行一次提醒检查，用于测试配置是否正确。

## 工作原理

1. 定时任务每天调用 `/api/cron/reminders`
2. 系统检查所有设置的提醒天数（如 7, 3, 1 天）
3. 对于每个天数，查找即将过期的用户：
   - VIP 用户（检查 `vipExpireAt`）
   - 管理员（检查 User 表的 `adminExpireAt`）
   - 付费用户（检查 `paidExpireAt`）
4. 发送提醒消息，使用配置的模板
5. 记录到 `ReminderLog`，防止重复发送

## 防重复机制

系统使用 `ReminderLog` 表记录已发送的提醒。每条记录包含：
- `telegramId` - 用户 ID
- `type` - 提醒类型（vip/admin/user）
- `daysLeft` - 剩余天数

这三个字段组成唯一索引，确保同一用户的同一类型提醒在相同剩余天数时只发送一次。

## 监控和日志

### 查看提醒执行结果

定时任务会返回 JSON 响应：
```json
{
  "success": true,
  "sent": 5,
  "skipped": 10
}
```

- `sent` - 本次发送的提醒数量
- `skipped` - 跳过的提醒数量（已发送过）

### 检查提醒记录

可以查询 `ReminderLog` 表查看历史发送记录：
```sql
SELECT * FROM "ReminderLog" ORDER BY "sentAt" DESC LIMIT 100;
```

## 故障排查

### 提醒未发送

1. 检查 `ReminderSetting` 表，确认 `isEnabled` 为 `true`
2. 检查定时任务是否正常执行
3. 检查 `CRON_SECRET` 环境变量是否配置正确
4. 检查用户的过期时间字段是否设置正确

### 重复发送

如果需要重新发送提醒（例如测试），可以删除 `ReminderLog` 中的相关记录：
```sql
DELETE FROM "ReminderLog" WHERE "telegramId" = 'USER_ID' AND "type" = 'vip';
```

## 安全注意事项

1. **CRON_SECRET** 必须使用强随机字符串
2. 不要在代码中硬编码 CRON_SECRET
3. 定期检查定时任务日志，确保没有未授权访问
4. 定时任务 API 只接受 GET 请求，且必须包含正确的 Authorization 头

## 更新和维护

### 修改提醒模板

在设置页面修改模板后，新的提醒将使用更新后的模板。

### 调整提醒天数

可以在设置页面添加或移除提醒天数。例如，添加 14 天提前提醒：
1. 在代码中的 `AVAILABLE_DAYS` 数组添加 14
2. 在设置页面勾选 14 天选项
3. 保存设置

### 清理旧提醒记录

建议定期清理 90 天前的提醒记录：
```sql
DELETE FROM "ReminderLog" WHERE "sentAt" < NOW() - INTERVAL '90 days';
```

## API 文档

### GET /api/cron/reminders

执行提醒检查任务。

**请求头：**
```
Authorization: Bearer ${CRON_SECRET}
```

**响应：**
```json
{
  "success": true,
  "sent": 5,
  "skipped": 10
}
```

### GET /api/settings/reminders

获取提醒设置（需要 Telegram 认证）。

**响应：**
```json
{
  "data": {
    "id": "...",
    "isEnabled": true,
    "reminderDays": "7,3,1",
    "vipTemplate": "...",
    "adminTemplate": "...",
    "userTemplate": "..."
  }
}
```

### PUT /api/settings/reminders

更新提醒设置（需要超级管理员权限）。

**请求体：**
```json
{
  "isEnabled": true,
  "reminderDays": "7,3,1",
  "vipTemplate": "...",
  "adminTemplate": "...",
  "userTemplate": "..."
}
```

### POST /api/settings/reminders

手动触发提醒检查（需要超级管理员权限）。

**响应：**
```json
{
  "success": true,
  "sent": 2,
  "skipped": 3
}
```
