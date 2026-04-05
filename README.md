# 🤖 Telegram 搜索报告管理机器人

一个完整的 Telegram 机器人系统，支持报告提交（机器人内逐步填写）、审核（含"需要补充材料"中间状态）、全文关键词搜索和多频道推送，提供 Mini App 管理后台，支持 Railway 一键部署。

## ✨ 功能特性

### 管理员功能
- 🔧 Mini App 管理后台（配置全部机器人行为）
- 📢 配置强制订阅频道（支持多个，未订阅所有频道则无法使用）
- 📤 设置报告推送频道（支持多个，审核通过后自动推送文字摘要+链接，不推送图片/文件）
- 🎬 自定义 `/start` 内容（支持图片/视频和自定义按钮）
- ⌨️ 自定义底部键盘菜单按钮
- 💬 自定义审核反馈文案（通过/拒绝/待审核/需补充材料）
- ✅ 报告审核工作流（通过 / 拒绝 / 🔎 需要补充材料）
- 👥 支持多管理员（`ADMIN_IDS` 环境变量）

### 用户功能
- 🔒 自动检测频道订阅状态（未订阅所有频道则提示）
- 📱 显示自定义 `/start` 欢迎内容
- ⌨️ 点击底部键盘菜单进行操作
- 📝 **在机器人内逐步填写报告**（无需跳转外部链接）
  - 支持文本、图片/文件、地理位置、单选、多选字段
  - 边填写边预览，可修改任意字段，最后提交审核
  - 草稿自动保存
- 🔍 查阅报告（全文关键词、`@用户名`、`#标签` 搜索）
- 📩 接收审核结果通知（通过/拒绝/需要补充材料）
- 🔄 被要求补充材料后可继续填写并重新提交

## 🏗️ 技术架构

```
telegram-report-bot/
├── backend/               # Node.js + Express + Telegraf
│   ├── src/
│   │   ├── bot/          # Telegram Bot 逻辑
│   │   │   ├── handlers/
│   │   │   │   ├── start.js        # /start、/admin 指令
│   │   │   │   ├── report.js       # 查阅报告、搜索
│   │   │   │   └── reportWizard.js # 机器人内逐步填写报告向导
│   │   │   ├── index.js            # Bot 实例、所有 callback 注册
│   │   │   ├── keyboards.js        # 键盘/按钮构建
│   │   │   └── middleware.js       # 订阅检查（多频道）、admin 判断
│   │   ├── api/          # REST API（供 Mini App 调用）
│   │   ├── models/       # Sequelize 数据模型
│   │   │   ├── Report.js       # 含 need_more_info 状态、多频道推送记录
│   │   │   ├── ReportDraft.js  # 机器人内填写草稿
│   │   │   ├── Admin.js        # 管理员配置
│   │   │   └── User.js
│   │   ├── db/           # 数据库连接（含 pg_trgm）
│   │   ├── config/       # 配置管理（ADMIN_IDS/REQUIRED_CHATS/PUBLISH_CHATS）
│   │   └── utils/        # 工具函数（JWT、URL 拼接等）
│   ├── .env.example
│   ├── package.json
│   └── Dockerfile
├── frontend/              # Vue 3 + Vite Mini App
├── docker-compose.yml
├── railway.json
└── README.md
```

## 🚀 快速部署（Railway）

### 1. 准备工作

1. 在 [@BotFather](https://t.me/BotFather) 创建机器人，获取 `BOT_TOKEN`
2. 获取你的 Telegram ID（发消息给 [@userinfobot](https://t.me/userinfobot)）
3. 将机器人设为你要订阅/推送的频道/群的**管理员**

### 2. 一键部署到 Railway

1. Fork 此仓库到你的 GitHub 账号
2. 登录 [Railway](https://railway.app) → 新建项目 → 从 GitHub 部署
3. 添加 **PostgreSQL** 插件（Railway 会自动注入 `DATABASE_URL`）
4. 在项目 Variables 页面添加环境变量（见下方）
5. 点击 Deploy

### 3. 环境变量配置

在 Railway 项目的 Variables 页面添加以下环境变量：

| 变量名 | 必填 | 说明 | 示例 |
|--------|------|------|------|
| `BOT_TOKEN` | ✅ | Telegram Bot Token | `1234567890:AAHxxxxxxx` |
| `ADMIN_IDS` | ✅ | 管理员 Telegram ID（多个用逗号分隔） | `5528758975,123456789` |
| `DATABASE_URL` | ✅ | PostgreSQL 连接字符串（Railway 自动注入）| `postgresql://...` |
| `JWT_SECRET` | ✅ | JWT 签名密钥（随机字符串）| `your-super-secret-key` |
| `WEBHOOK_URL` | ✅ | Railway 部署域名（用于 Webhook 模式，**不带末尾 /**）| `https://yourapp.up.railway.app` |
| `API_URL` | ✅ | API 服务器地址（同 WEBHOOK_URL）| `https://yourapp.up.railway.app` |
| `FRONTEND_URL` | ✅ | 前端地址（同 API_URL）| `https://yourapp.up.railway.app` |
| `REQUIRED_CHATS` | ❌ | 强制订阅频道/群 ID（逗号分隔，**需替换为真实 chat_id**）| `-100123456789,-100987654321` |
| `PUBLISH_CHATS` | ❌ | 报告推送频道 ID（逗号分隔，**需替换为真实 chat_id**）| `-100789123456` |
| `BOT_MODE` | ❌ | Bot 启动模式：`auto`/`webhook`/`polling`（默认 `auto`）| `auto` |
| `WEBHOOK_PATH` | ❌ | Webhook 路径（默认 `/webhook`）| `/webhook` |
| `PORT` | ❌ | 服务端口（Railway 自动设置）| `8080` |

> ⚠️ **注意**：`REQUIRED_CHATS` 和 `PUBLISH_CHATS` 中的示例 chat_id（如 `-100123456789`）是占位符，必须替换为真实值。
>
> **如何获取真实 chat_id**：将 [@userinfobot](https://t.me/userinfobot) 加入你的频道/群，它会告诉你 chat_id；也可使用 [getUpdates API](https://core.telegram.org/bots/api#getupdates) 抓取。

#### Bot 模式说明

| 模式 | 触发条件 | 用途 |
|------|----------|------|
| `auto` | 默认 | 生产环境自动 Webhook，本地自动 Polling |
| `webhook` | `BOT_MODE=webhook` | 强制使用 Webhook |
| `polling` | `BOT_MODE=polling` | 强制使用 Polling（本地开发推荐）|

#### 如何设置 Bot 为频道/群管理员

1. 打开 Telegram，进入你的频道/群
2. 频道设置 → 管理员 → 添加管理员 → 搜索你的 Bot
3. 至少开启**发送消息**和**查看成员**权限（后者用于 getChatMember 订阅检查）

#### 如何验证 Webhook 已设置

部署成功后，访问以下 URL 验证：

```
https://api.telegram.org/bot<BOT_TOKEN>/getWebhookInfo
```

返回的 `url` 字段应为非空（如 `https://yourapp.up.railway.app/webhook`）。

日志中应看到：
```
[BOT] Webhook mode | path: /webhook | url: https://yourapp.up.railway.app/webhook
```

### 4. 配置 Mini App

1. 在 [@BotFather](https://t.me/BotFather) 中，使用 `/newapp` 创建 Mini App
2. 设置 Mini App URL 为：`https://yourapp.up.railway.app`
3. 管理员后台：发送 `/admin` → 点击"进入管理后台"
4. 报告查询页面：`https://yourapp.up.railway.app/query`

---

## 🛠️ 本地开发

### 前置条件
- Node.js >= 18
- PostgreSQL（本地或 Docker）

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
# 编辑 .env，填入 BOT_TOKEN、ADMIN_IDS、DATABASE_URL 等

# 4. 安装前端依赖并构建
cd ../frontend
npm install
npm run build  # 输出到 backend/frontend-dist

# 5. 启动后端（含前端静态文件服务 + 机器人 Polling 模式）
cd ../backend
npm run dev
```

### 使用 Docker Compose（推荐）

```bash
cp backend/.env.example .env
# 编辑 .env

docker-compose up -d
docker-compose logs -f backend
```

---

## 📱 使用方式

### 管理员配置流程

1. 向机器人发送 `/admin`，点击"进入管理后台"按钮
2. 在管理后台中可配置：
   - 强制订阅频道（在 Railway 中设置 `REQUIRED_CHATS` 环境变量）
   - 报告推送频道（在 Railway 中设置 `PUBLISH_CHATS` 环境变量）
   - 自定义 `/start` 欢迎内容
   - 配置底部键盘菜单按钮
   - 自定义审核反馈文案（含"需要补充材料"模板）
   - 自定义报告模板字段

### 用户使用流程

1. 打开机器人，系统自动检测是否已订阅所有频道
2. 未订阅时，机器人提供每个频道的订阅按钮；全部订阅后点击"我已加入，重新检测"
3. 订阅后发送 `/start` 显示欢迎内容
4. 点击"📝 写报告"，**在机器人内逐步填写**：
   - 按提示逐字段填写（文字、图片、单选等）
   - 每步完成后显示当前预览
   - 可点击"修改"某字段重新填写
   - 全部完成后点击"✅ 提交审核"
5. 管理员审核后用户收到通知（通过/拒绝/需要补充材料）
6. 如被要求补充材料，可补充后重新提交
7. 点击"🔍 查阅报告"，发送：
   - `@用户名` 按用户搜索
   - `#标签` 按标签搜索
   - 任意关键词全文检索

### 报告搜索

在机器人聊天中直接发送：
- `@zhangsan` → 查询用户 zhangsan 的已通过报告
- `#项目报告` → 查询标签为"项目报告"的已通过报告
- `诈骗` → 全文关键词检索

---

## 📊 数据模型

### Admin（管理员配置）
- `channelId`: 强制订阅频道（单个，向后兼容；推荐用 `REQUIRED_CHATS` 环境变量）
- `pushChannelId`: 报告推送频道（单个，向后兼容；推荐用 `PUBLISH_CHATS` 环境变量）
- `startContent`: /start 内容（文本、媒体、按钮）
- `keyboards`: 底部键盘菜单配置
- `reportTemplate`: 报告填写模板（字段列表）
- `reviewFeedback`: 审核反馈文案（通过/拒绝/待审核/需要补充材料）

### Report（报告）
- `userId/username`: 提交者信息
- `title/description`: 标题和内容
- `content`: JSONB，完整字段数据（含图片 file_id、地理坐标等）
- `tags`: 标签数组
- `status`: 状态（`pending` / `approved` / `rejected` / `need_more_info`）
- `needMoreInfoNote`: 管理员要求补充的具体说明
- `channelMessages`: JSONB 数组，每个推送频道的 `{chatId, messageId, url}`
- `channelMessageId`: 第一个频道的 message_id（向后兼容）
- `reportNumber`: 自增报告编号

### ReportDraft（报告草稿）
- `userId`: 用户 ID（主键，每用户一份草稿）
- `currentStep`: 当前填写到第几步
- `data`: JSONB，已填写的字段数据
- `templateFields`: 草稿创建时的模板快照

### User（用户）
- `userId/username`: Telegram 用户信息
- `isSubscribed`: 订阅状态（缓存）

---

## 🔌 API 接口

### 认证
```
POST /api/auth/telegram
Body: { initData: "Telegram Web App initData" }
Response: { success: true, token: "jwt_token", user: {..., isAdmin: bool} }
```

### 管理员接口（需要 Admin JWT）
```
GET  /api/admin/config              # 获取配置
PUT  /api/admin/config              # 更新配置
GET  /api/admin/reports?status=     # 获取报告列表（支持 need_more_info 状态过滤）
PUT  /api/admin/reports/:id/review  # 审核报告（status: approved|rejected|need_more_info）
```

### 用户接口
```
POST /api/reports                   # 提交报告（需要 JWT）
GET  /api/reports/search?q=&type=   # 搜索报告（公开，支持关键词全文检索）
GET  /api/health                    # 健康检查
```

---

## 🔒 安全说明

- 所有 Mini App 请求通过 Telegram `initData` 签名验证用户身份
- 管理员接口通过 JWT + `ADMIN_IDS` 双重验证
- 订阅状态实时通过 Telegram `getChatMember` API 验证（所有频道均需订阅）
- JWT 密钥通过环境变量配置，不硬编码
- URL 拼接使用 `joinUrl()` 统一处理，避免双斜杠问题

---

## 📝 License

MIT
