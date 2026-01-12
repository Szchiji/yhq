# Cron 定时任务部署指南

本系统需要配置以下定时任务才能正常运行。

## 环境变量

首先在 Railway 添加环境变量：

```
CRON_SECRET=your-random-secret-string
```

生成方式：
```bash
openssl rand -hex 32
```

## 定时任务列表

### 1. 定时开奖（每分钟）

检查所有到期的抽奖并自动开奖。

- **URL**: `https://your-domain.com/api/cron/draw`
- **Method**: GET
- **Schedule**: `* * * * *` (每分钟)
- **Headers**: 
  ```
  Authorization: Bearer ${CRON_SECRET}
  ```

### 2. 定时发送消息（每分钟）

检查所有到期的定时消息并发送。

- **URL**: `https://your-domain.com/api/cron/scheduled`
- **Method**: GET
- **Schedule**: `* * * * *` (每分钟)
- **Headers**: 
  ```
  Authorization: Bearer ${CRON_SECRET}
  ```

### 3. 过期提醒（每天早上 9:00）

检查即将过期的 VIP/管理员权限并发送提醒。

- **URL**: `https://your-domain.com/api/cron/reminders`
- **Method**: GET
- **Schedule**: `0 9 * * *` (每天 09:00)
- **Headers**: 
  ```
  Authorization: Bearer ${CRON_SECRET}
  ```

## Railway 配置方法

### 方法一：使用 Railway Cron（推荐）

1. 在 Railway 项目中添加 Cron 服务
2. 配置三个定时任务（如上所述）

### 方法二：使用外部 Cron 服务

推荐使用以下免费服务：

- **cron-job.org** - 免费，支持每分钟
- **EasyCron** - 免费计划支持每分钟
- **UptimeRobot** - 可用作简单的定时调用

配置示例（cron-job.org）：

1. 注册账号
2. 创建新任务
3. 填写 URL 和 Headers
4. 设置 Schedule

## 测试定时任务

手动测试各个 API：

```bash
# 测试定时开奖
curl -H "Authorization: Bearer YOUR_CRON_SECRET" \
  https://your-domain.com/api/cron/draw

# 测试定时发送
curl -H "Authorization: Bearer YOUR_CRON_SECRET" \
  https://your-domain.com/api/cron/scheduled

# 测试过期提醒
curl -H "Authorization: Bearer YOUR_CRON_SECRET" \
  https://your-domain.com/api/cron/reminders
```

## 监控

建议配置告警，当定时任务连续失败时通知管理员。

可以在每个 Cron API 中添加失败通知逻辑，向超级管理员发送 Telegram 消息。
