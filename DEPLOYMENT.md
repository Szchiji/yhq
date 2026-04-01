# 部署指南

本文档介绍如何部署企业级报告系统。

## 快速开始

### 本地开发

```bash
# 1. 复制环境变量示例文件
cp .env.example .env

# 2. 编辑 .env 填写必要配置
# 至少需要设置：
# - BOT_TOKEN：从 @BotFather 获取
# - ADMIN_IDS：你的 Telegram 用户 ID

# 3. 安装依赖
pip install -r requirements.txt

# 4. 启动机器人
python main.py
```

### Docker 本地部署

```bash
# 使用根目录的 docker-compose
docker-compose up -d

# 或使用 docker/ 目录中的完整编排
cd docker
docker-compose up -d
```

### Railway 云部署

1. Fork 本仓库到你的 GitHub 账户
2. 访问 [railway.app](https://railway.app) 并创建新项目
3. 选择 "Deploy from GitHub repo"
4. 选择你的仓库
5. 添加 PostgreSQL 和 Redis 服务
6. 在 Variables 中设置环境变量（见下方）
7. 部署完成后查看日志确认启动

## 环境变量

### 必填

| 变量 | 说明 |
|------|------|
| `BOT_TOKEN` | Telegram Bot Token（从 @BotFather 获取） |
| `ADMIN_IDS` | 管理员 Telegram ID，多个用逗号分隔 |
| `SECRET_KEY` | 应用密钥（至少 32 位随机字符串） |

### 数据库

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `DATABASE_TYPE` | `sqlite` | 数据库类型：sqlite/postgresql/mysql |
| `DATABASE_URL` | - | PostgreSQL/MySQL 连接字符串 |
| `SQLITE_DB_PATH` | `data/bot.db` | SQLite 文件路径 |

### 缓存（可选）

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `REDIS_URL` | - | Redis 连接字符串 |
| `CACHE_BACKEND` | `memory` | 缓存后端：memory/redis |

### 邮件（可选）

| 变量 | 说明 |
|------|------|
| `SMTP_HOST` | SMTP 服务器地址 |
| `SMTP_PORT` | SMTP 端口（通常 587） |
| `SMTP_USERNAME` | 邮箱账号 |
| `SMTP_PASSWORD` | 邮箱密码/授权码 |
| `SMTP_FROM` | 发件人地址 |

### 运行模式

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `BOT_MODE` | `polling` | 运行模式：polling/webhook/hybrid |
| `WEBHOOK_URL` | - | Webhook URL（webhook 模式必填） |
| `WEBHOOK_PORT` | `8000` | Webhook 监听端口 |

## 生成 SECRET_KEY

```python
import secrets
print(secrets.token_urlsafe(32))
```

或：

```bash
openssl rand -base64 32
```

## 邮件服务配置

### Gmail

```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=your-email@gmail.com
SMTP_PASSWORD=xxxx xxxx xxxx xxxx  # 应用专用密码
SMTP_FROM=your-email@gmail.com
```

获取 Gmail 应用专用密码：
1. 访问 https://myaccount.google.com/security
2. 找到"应用专用密码"并生成

### QQ 邮箱

```
SMTP_HOST=smtp.qq.com
SMTP_PORT=587
SMTP_USERNAME=your-qq@qq.com
SMTP_PASSWORD=授权密码
SMTP_FROM=your-qq@qq.com
```

## 健康检查

应用启动后可通过以下端点检查健康状态：

```bash
curl http://your-domain/health
# 返回：{"status": "ok", ...}
```

## 日志

日志文件保存在 `logs/` 目录。在 Railway 上可通过 Deployments → Logs 查看实时日志。
