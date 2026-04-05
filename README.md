# 🤖 Telegram 搜索报告管理机器人

一个完整的 Telegram 机器人系统，支持报告提交（机器人内逐步填写）、审核（含"需要补充材料"中间状态、多轮补充循环）、全文关键词搜索和多频道推送，提供 Mini App 管理后台（支持普通浏览器通过 OTP 登录），支持 Railway 一键部署。

## ✨ 功能特性

### 管理员功能
- 🔧 Mini App 管理后台（配置全部机器人行为，**普通浏览器可用，无需 Telegram 内打开**）
- 🔐 **浏览器 OTP 登录**：网页生成 6 位验证码 → 管理员私聊机器人发送 → 自动跳转后台
- 📢 配置强制订阅频道（支持多个，未订阅所有频道则无法使用）
- 📤 设置报告推送频道（支持多个，审核通过后自动推送文字摘要+链接，不推送图片/文件）
- 🎬 自定义 `/start` 内容（支持图片/视频和自定义按钮）
- ⌨️ 自定义底部键盘菜单按钮
- 💬 自定义审核反馈文案（通过/拒绝/待审核/需补充材料）
- ✅ 报告审核工作流（通过 / 拒绝 / 🔎 需要补充材料）
- 👥 支持多管理员（`ADMIN_IDS` 环境变量）
- 🔒 **多管理员加锁**：只有第一个审核生效，其他管理员操作提示"已处理"

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
- 🔄 被要求补充材料后可多轮补充并重新提交（`pending ↔ need_more_info` 循环）

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
│   │   │   ├── Report.js           # 含 need_more_info 状态、多频道推送记录
│   │   │   ├── ReportDraft.js      # 机器人内填写草稿
│   │   │   ├── Admin.js            # 管理员配置
│   │   │   ├── AdminLoginOtp.js    # 浏览器 OTP 登录一次性验证码
│   │   │   └── User.js
│   │   ├── db/
│   │   │   ├── index.js            # 数据库连接（含 pg_trgm）
│   │   │   ├── config.js           # sequelize-cli 配置
│   │   │   └── migrations/         # Sequelize 迁移文件
│   │   ├── config/       # 配置管理（ADMIN_IDS/REQUIRED_CHATS/PUBLISH_CHATS）
│   │   └── utils/        # 工具函数（JWT、URL 拼接等）
│   ├── .sequelizerc
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
3. **每个管理员必须先私聊机器人发一次 `/start`**，否则机器人无法主动发私聊通知（Telegram 限制）
4. 将机器人设为你要订阅/推送的频道/群的**管理员**

### 2. 一键部署到 Railway

1. Fork 此仓库到你的 GitHub 账号
2. 登录 [Railway](https://railway.app) → 新建项目 → 从 GitHub 部署
3. 添加 **PostgreSQL** 插件（Railway 会自动注入 `DATABASE_URL`）
4. 在项目 Variables 页面添加环境变量（见下方）
5. 点击 Deploy

> **Railway 启动命令**已在 `railway.json` 中配置为先运行数据库迁移再启动服务：
> ```
> cd backend && npm run db:migrate && npm start
> ```
> 无需手动设置，迁移会在每次部署时自动执行（幂等操作）。

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

### 4. 管理后台 OTP 登录（浏览器可用）

> 无需在 Telegram 内打开，任何浏览器均可使用此方式登录后台。

1. 用浏览器访问：`https://yourapp.up.railway.app/admin`
2. 点击"获取验证码"，页面显示 6 位数字验证码（有效期 5 分钟）
3. 打开 Telegram，**私聊**机器人，发送该 6 位数字（不要发群里）
4. 机器人验证你是否在 `ADMIN_IDS` 中
   - ✅ 验证成功：页面自动跳转到管理后台
   - ❌ 非管理员：机器人回复"无管理员权限"
   - 群里发送：机器人提示"请私聊发送"

> ⚠️ 前提：管理员必须先私聊机器人发过一次 `/start`，否则机器人无法收到你发的验证码消息（Telegram 隐私设置限制）。

### 5. 配置 Mini App

1. 在 [@BotFather](https://t.me/BotFather) 中，使用 `/newapp` 创建 Mini App
2. 设置 Mini App URL 为：`https://yourapp.up.railway.app`
3. 管理员后台：发送 `/admin` → 点击"进入管理后台"
4. 报告查询页面：`https://yourapp.up.railway.app/query`

---

## 🗃️ 数据库迁移（Sequelize Migrations）

本项目使用 `sequelize-cli` 管理数据库 schema 演进，生产环境不依赖 `sync({ alter: true })`。

### 自动执行（Railway）

Railway 的启动命令已配置为先执行迁移：
```bash
cd backend && npm run db:migrate && npm start
```

### 手动执行

```bash
cd backend

# 运行所有待执行迁移
npm run db:migrate

# 查看迁移状态
npm run db:migrate:status

# 回滚最近一次迁移（谨慎）
npm run db:migrate:undo
```

### 迁移文件说明

| 文件 | 说明 |
|------|------|
| `20240101000001-add-needMoreInfoNote-to-reports.js` | 为 reports 表添加 `needMoreInfoNote` 列（修复线上报错） |
| `20240101000002-create-admin-login-otps.js` | 创建 `admin_login_otps` 表（OTP 浏览器登录） |

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

# 4. 运行数据库迁移
npm run db:migrate

# 5. 安装前端依赖并构建
cd ../frontend
npm install
npm run build  # 输出到 backend/frontend-dist

# 6. 启动后端（含前端静态文件服务 + 机器人 Polling 模式）
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

1. 用浏览器访问 `https://yourapp.up.railway.app/admin`
2. 点击"获取验证码"，发送给机器人完成验证
3. 进入后台后可配置：
   - 强制订阅频道（在 Railway 中设置 `REQUIRED_CHATS` 环境变量）
   - 报告推送频道（在 Railway 中设置 `PUBLISH_CHATS` 环境变量）
   - 自定义 `/start` 欢迎内容
   - 配置底部键盘菜单按钮
   - 自定义审核反馈文案（含"需要补充材料"模板）
   - 自定义报告模板字段

### 审核流程（多管理员）

1. 用户提交报告 → 所有管理员私聊收到审核卡片（带 ✅通过 / ❌拒绝 / 🔎补充材料 按钮）
2. **任意一个管理员先点击生效**，其他管理员再点击时提示"已由其他管理员处理"
3. 状态机规则：
   - `pending` → 管理员可通过/拒绝/要求补充
   - `need_more_info` → **不可直接通过/拒绝**，必须等用户补充后重新提交
   - 用户补充并点击"🔄 补充完成，重新提交" → 状态回到 `pending`，再次通知所有管理员
   - 支持多轮补充循环，直到通过或拒绝

### 用户使用流程

1. 打开机器人，系统自动检测是否已订阅所有频道
2. 未订阅时，机器人提供每个频道的订阅按钮；全部订阅后点击"我已加入，重新检测"
3. 订阅后发送 `/start` 显示欢迎内容
4. 点击"📝 写报告"，**在机器人内逐步填写**
5. 管理员审核后用户收到通知
6. 如被要求补充材料，收到通知中有"🔄 补充完成，重新提交"按钮，可多轮补充

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
- `reviewedBy/reviewedAt`: 谁在什么时候审核的
- `channelMessages`: JSONB 数组，每个推送频道的 `{chatId, messageId, url}`
- `channelMessageId`: 第一个频道的 message_id（向后兼容）
- `reportNumber`: 自增报告编号

### AdminLoginOtp（管理员 OTP 登录）
- `code`: 6 位验证码
- `expiresAt`: 过期时间（生成后 5 分钟）
- `verifiedAt/verifiedBy`: 机器人验证的时间和管理员 Telegram ID
- `usedAt`: 网页取走 JWT token 的时间（防重放）
- `clientIp/userAgent`: 请求来源（审计用）

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

POST /api/auth/otp/request
Response: { success: true, otpId: "uuid", code: "123456", expiresIn: 300 }

GET  /api/auth/otp/status?otpId=...
Response: { success: true, status: "pending"|"verified"|"expired"|"used", token?: "jwt" }
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

- 管理员后台支持两种登录方式：Telegram WebApp initData（Mini App 内）或 OTP（普通浏览器）
- OTP 验证码：6 位、5 分钟有效、一次性使用、仅接受私聊消息、仅接受 ADMIN_IDS 中的管理员验证
- 多管理员原子条件更新防止并发审核重复生效
- 所有 Mini App 请求通过 Telegram `initData` 签名验证用户身份
- 管理员接口通过 JWT + `ADMIN_IDS` 双重验证
- 订阅状态实时通过 Telegram `getChatMember` API 验证（所有频道均需订阅）
- JWT 密钥通过环境变量配置，不硬编码
- URL 拼接使用 `joinUrl()` 统一处理，避免双斜杠问题

---

## 📝 License

MIT

