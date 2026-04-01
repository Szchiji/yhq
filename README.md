# 报告管理系统 📊

一个功能完整的报告管理平台，集成 Telegram Bot 界面和 REST API，支持报告提交、审核、模板管理等核心功能。

## 🎯 核心功能

### Telegram Bot
- **报告提交**：通过 `/start` 打开菜单，填写结构化报告表单（支持预约截图、标签）
- **报告查询**：输入 `@用户名` 查看该用户的已发布报告列表
- **标签搜索**：在群组中输入 `#标签` 搜索匹配的报告（支持多标签）
- **管理员审核**：管理员通过/拒绝待审核报告，审核通过后自动推送到报告频道
- **模板管理**：管理员自定义报告字段、头部/尾部、预定义标签

### REST API (FastAPI)
- `GET /health` — 健康检查
- `GET /docs` — OpenAPI 文档（Swagger UI）
- `POST /api/v1/auth/token` — 获取访问令牌
- `GET /api/v1/reports/` — 报告列表
- `GET /api/v1/reports/{id}` — 单个报告
- `POST /api/v1/reports/{id}/approve` — 审核通过
- `POST /api/v1/reports/{id}/reject` — 拒绝报告
- `GET /api/v1/admin/stats` — 管理统计
- `GET /api/v1/admin/blacklist` — 黑名单管理

### Miniapp
- Web 前端（通过 Telegram WebApp 打开）
- 报告提交、查询、管理员审核界面

## 📁 项目结构

```
├── main.py              # Telegram Bot 启动入口
├── database.py          # 数据库操作（SQLite/PostgreSQL）
├── config.py            # 配置管理
├── states.py            # FSM 状态定义
├── bot_instance.py      # Bot 实例
│
├── handlers/            # Telegram Bot 处理器
│   ├── menu.py          # 主菜单
│   ├── report_form.py   # 报告表单处理
│   ├── admin.py         # 管理员菜单和审核
│   ├── template.py      # 模板管理
│   ├── mention_report.py # @用户名 报告查询
│   └── search.py        # #标签 搜索
│
├── api/                 # FastAPI REST API
│   ├── app.py           # FastAPI 应用（uvicorn 入口）
│   └── routes/          # API 路由
│       ├── health.py
│       ├── auth.py
│       ├── reports.py
│       ├── users.py
│       ├── admin.py
│       └── miniapp.py
│
├── services/            # 业务逻辑服务
├── models/              # 数据模型（Pydantic）
├── utils/               # 工具库（JWT、缓存、限流等）
├── core/                # 核心配置
├── miniapp/             # Web 前端（Node.js）
│
├── Dockerfile           # Docker 镜像
├── docker-compose.yml   # 编排（Bot + API + PostgreSQL + Redis）
├── requirements.txt     # Python 依赖
└── .env.example         # 环境变量示例
```

## 🚀 快速开始

### 本地运行（仅 Bot）

```bash
# 1. 安装依赖
pip install -r requirements.txt

# 2. 配置环境变量
cp .env.example .env
# 编辑 .env，填入 BOT_TOKEN 和 ADMIN_IDS

# 3. 启动机器人
python main.py
```

### Docker 部署（推荐）

```bash
# 1. 配置环境变量
cp .env.example .env
# 编辑 .env，填入必要配置

# 2. 启动所有服务
docker compose up -d

# 3. 验证部署
curl http://localhost:8000/health
# 返回：{"status": "ok", ...}

# 4. 查看 API 文档
# 浏览器打开：http://localhost:8000/docs
```

## ⚙️ 环境变量

| 变量 | 必填 | 说明 |
|------|------|------|
| `BOT_TOKEN` | ✅ | Telegram Bot Token（@BotFather 获取） |
| `ADMIN_IDS` | ✅ | 管理员 ID 列表（逗号分隔） |
| `DATABASE_URL` | 推荐 | PostgreSQL 连接 URL |
| `DATABASE_TYPE` | — | `sqlite`（开发）或 `postgresql`（生产，默认） |
| `SECRET_KEY` | ✅ | JWT 密钥（生产必须设置强随机值） |
| `API_KEY` | — | REST API 访问密钥 |
| `BOT_MODE` | — | `polling`（默认）/ `webhook` / `hybrid` |
| `WEBHOOK_URL` | webhook模式 | Webhook 公网 URL |
| `REDIS_URL` | — | Redis 连接 URL（可选，用于缓存） |
| `CORS_ORIGINS` | — | 允许的 CORS 来源（默认 `*`） |
| `LOG_LEVEL` | — | 日志级别（默认 `INFO`） |

详见 `.env.example`。

## 🐳 Docker Compose 服务

| 服务 | 说明 | 端口 |
|------|------|------|
| `postgres` | PostgreSQL 15 数据库 | 内部 |
| `redis` | Redis 7 缓存 | 内部 |
| `bot` | Telegram Bot（轮询/Webhook） | — |
| `api` | FastAPI REST API | `8000` |

## 📋 验收检查

```bash
# 健康检查
curl http://localhost:8000/health

# API 文档
open http://localhost:8000/docs

# 报告列表（需要先获取 token）
curl -H "Authorization: Bearer <token>" http://localhost:8000/api/v1/reports/
```

## 🔧 Breaking Changes（相比旧版）

- ❌ 已移除：快速评价功能（👍/👎 快速推荐）
- ❌ 已移除：广播系统
- ❌ 已移除：`@用户名` 快速评价统计卡片（改为显示报告列表）
- ❌ 已移除：自定义欢迎页面/按钮设置
- ✅ 新增：REST API（FastAPI）
- ✅ 新增：PostgreSQL 优先支持
- ✅ 新增：排行榜改为基于已发布报告数量
