# 🤖 Telegram 搜索报告管理机器人

一个完整的 Telegram 机器人系统，支持报告提交、审核、搜索和频道推送，提供 Mini App 管理后台，支持 Railway 一键部署。

## ✨ 功能特性

### 管理员功能
- 🔧 Mini App 管理后台（配置全部机器人行为）
- 📢 配置强制订阅频道（未订阅无法使用）
- 📤 设置报告推送频道（审核通过自动推送）
- 🎬 自定义 `/start` 内容（支持图片/视频和自定义按钮）
- ⌨️ 自定义底部键盘菜单按钮
- 💬 自定义审核反馈文案（通过/拒绝/待审核）
- ✅ 报告审核工作流（通过机器人消息或 Mini App 审核）

### 用户功能
- 🔒 自动检测频道订阅状态（未订阅提示订阅）
- 📱 显示自定义 `/start` 欢迎内容
- ⌨️ 点击底部键盘菜单进行操作
- 📝 填写报告（跳转 Mini App 表单）
- 🔍 查阅报告（发送 `@用户名` 或 `#标签` 搜索）
- 📩 接收审核结果通知

## 🏗️ 技术架构

```
telegram-report-bot/
├── backend/               # Node.js + Express + Telegraf
│   ├── src/
│   │   ├── bot/          # Telegram Bot 逻辑
│   │   ├── api/          # REST API（供 Mini App 调用）
│   │   ├── models/       # MongoDB 数据模型
│   │   ├── db/           # 数据库连接
│   │   ├── config/       # 配置管理
│   │   └── utils/        # 工具函数（JWT 认证等）
│   ├── .env.example
│   ├── package.json
│   └── Dockerfile
├── frontend/              # Vue 3 + Vite Mini App
│   ├── src/
│   │   ├── pages/
│   │   │   ├── AdminDashboard.vue  # 管理后台
│   │   │   ├── ReportForm.vue      # 报告填写
│   │   │   └── ReportQuery.vue     # 报告查询
│   │   ├── api/          # API 客户端
│   │   └── stores/       # Pinia 状态管理
│   ├── package.json
│   └── vite.config.js
├── docker-compose.yml
├── railway.json
└── README.md
```

## 🚀 快速部署（Railway）

### 1. 准备工作

1. 在 [@BotFather](https://t.me/BotFather) 创建机器人，获取 `BOT_TOKEN`
2. 获取你的 Telegram ID（发送消息给 [@userinfobot](https://t.me/userinfobot)）
3. 注册 [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) 免费数据库，获取连接字符串

### 2. 一键部署到 Railway

[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/new/template)

或者手动部署：

1. Fork 此仓库到你的 GitHub 账号
2. 登录 [Railway](https://railway.app) 并创建新项目
3. 选择 "Deploy from GitHub repo" 并选择 Fork 的仓库
4. 在 Railway 项目设置中添加环境变量（见下方）
5. 点击 Deploy

### 3. 环境变量配置

在 Railway 项目的 Variables 页面添加以下环境变量：

| 变量名 | 必填 | 说明 | 示例 |
|--------|------|------|------|
| `BOT_TOKEN` | ✅ | Telegram Bot Token | `1234567890:AAHxxxxxxx` |
| `ADMIN_ID` | ✅ | 管理员 Telegram ID | `123456789` |
| `DATABASE_URL` | ✅ | PostgreSQL 连接字符串（Railway 自动注入）| `postgresql://...` |
| `JWT_SECRET` | ✅ | JWT 签名密钥（随机字符串）| `your-super-secret-key` |
| `WEBHOOK_URL` | ✅ | Railway 部署域名（用于 Webhook 模式）| `https://yourapp.up.railway.app` |
| `API_URL` | ✅ | API 服务器地址 | `https://yourapp.up.railway.app` |
| `FRONTEND_URL` | ✅ | 前端地址（同 API_URL）| `https://yourapp.up.railway.app` |
| `BOT_MODE` | ❌ | Bot 启动模式：`auto`/`webhook`/`polling`（默认 `auto`）| `auto` |
| `WEBHOOK_PATH` | ❌ | Webhook 路径（默认 `/webhook`）| `/webhook` |
| `PORT` | ❌ | 服务端口（Railway 自动设置）| `8080` |

> **说明**：`BOT_MODE=auto` 时，若同时设置了 `WEBHOOK_URL` 且 `NODE_ENV=production`，则自动使用 Webhook 模式；否则使用 Polling 模式。

#### Bot 模式说明

| 模式 | 触发条件 | 用途 |
|------|----------|------|
| `auto` | 默认 | 生产环境自动 Webhook，本地自动 Polling |
| `webhook` | `BOT_MODE=webhook` | 强制使用 Webhook |
| `polling` | `BOT_MODE=polling` | 强制使用 Polling（本地开发推荐）|

#### 如何验证 Webhook 已设置

部署成功后，可通过以下 Telegram API 查看 webhook 状态：

```
https://api.telegram.org/bot<BOT_TOKEN>/getWebhookInfo
```

日志中应看到：
```
[BOT] Webhook mode | path: /webhook | url: https://yourapp.up.railway.app/webhook
```

### 4. 配置 Mini App

1. 在 [@BotFather](https://t.me/BotFather) 中，使用 `/newapp` 创建 Mini App
2. 设置 Mini App URL 为：`https://yourapp.up.railway.app`
3. 管理员后台地址：`https://yourapp.up.railway.app/admin`
4. 报告填写页面：`https://yourapp.up.railway.app/report`
5. 报告查询页面：`https://yourapp.up.railway.app/query`

### 5. 前端构建（Railway 自动处理）

Railway 会在部署时自动构建前端，构建后的静态文件由后端 Express 服务提供。

---

## 🛠️ 本地开发

### 前置条件
- Node.js >= 18
- MongoDB（本地或 Atlas）

### 步骤

```bash
# 1. 克隆仓库
git clone https://github.com/Szchiji/yhq.git
cd yhq

# 2. 安装后端依赖
cd backend
npm install

# 3. 配置环境变量
cp .env.example .env
# 编辑 .env 填入必要的配置

# 4. 安装前端依赖并构建
cd ../frontend
npm install
npm run build  # 构建到 backend/frontend-dist

# 5. 启动后端（包含前端静态文件服务）
cd ../backend
npm run dev
```

### 使用 Docker Compose（推荐）

```bash
# 复制并编辑环境变量
cp backend/.env.example .env
# 编辑 .env

# 启动所有服务
docker-compose up -d

# 查看日志
docker-compose logs -f backend
```

---

## 📱 使用方式

### 管理员配置流程

1. 向机器人发送 `/admin`，点击"进入管理后台"按钮
2. 在管理后台中：
   - 配置强制订阅频道（输入 `@频道名` 或频道 ID）
   - 配置报告推送频道
   - 自定义 `/start` 欢迎内容
   - 配置底部键盘菜单按钮
   - 自定义审核反馈文案
3. 点击"保存配置"

### 用户使用流程

1. 打开机器人，系统自动检测是否已订阅频道
2. 未订阅时，机器人提供订阅按钮
3. 订阅后发送 `/start` 显示欢迎内容
4. 点击"写报告"跳转 Mini App 填写表单
5. 填写完成提交，等待管理员审核
6. 点击"查阅报告"，发送 `@用户名` 或 `#标签` 查询

### 报告搜索

在机器人聊天中直接发送：
- `@zhangsan` → 查询用户 zhangsan 的所有已审核报告
- `#项目报告` → 查询标签为"项目报告"的所有已审核报告

---

## 🔌 API 接口

### 认证
```
POST /api/auth/telegram
Body: { initData: "Telegram Web App initData" }
Response: { success: true, token: "jwt_token", user: {...} }
```

### 管理员接口（需要 Admin JWT）
```
GET  /api/admin/config              # 获取配置
PUT  /api/admin/config              # 更新配置
GET  /api/admin/reports?status=     # 获取报告列表
PUT  /api/admin/reports/:id/review  # 审核报告
```

### 用户接口
```
POST /api/reports                   # 提交报告（需要 JWT）
GET  /api/reports/search?q=&type=   # 搜索报告（公开）
GET  /api/health                    # 健康检查
```

---

## 📊 数据模型

### Admin（管理员配置）
- `channelId`: 强制订阅频道
- `pushChannelId`: 报告推送频道
- `startContent`: /start 内容（文本、媒体、按钮）
- `keyboards`: 底部键盘菜单配置
- `reportTemplate`: 报告填写模板
- `reviewFeedback`: 审核反馈文案

### Report（报告）
- `userId/username`: 提交者信息
- `title/description`: 标题和内容
- `tags`: 标签数组
- `status`: 状态（pending/approved/rejected）
- `reportNumber`: 自增报告编号

### User（用户）
- `userId/username`: Telegram 用户信息
- `isSubscribed`: 订阅状态

---

## 🔒 安全说明

- 所有 Mini App 请求通过 Telegram `initData` 验证用户身份
- 管理员接口通过 JWT + adminId 双重验证
- 订阅状态实时通过 Telegram API 验证
- JWT 密钥通过环境变量配置，不硬编码

---

## 📝 License

MIT
