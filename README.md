# 教师评价平台 🎓

一个功能完整的 Telegram 教师评价机器人，支持快速评价、详细报告、预约截图验证、标签搜索等核心功能。

## 📊 核心功能

### 系统 A：快速评价
- 用户在群组中输入 `@用户名` 查询教师评价统计
- 点击【👍推荐】或【👎不推荐】快速评价
- 在机器人中输入一句话理由（≥12字）
- 立即保存并展示到排行榜

### 系统 B：详细报告
- 点击【📝写报告】进入详细表单
- 逐步填写结构化的报告字段
- **上传预约截图（1-3 张，必填）**
- **输入标签（可选/必填，可配置）**
- 预览报告内容并提交审核
- 管理员审核通过后自动推送到报告频道
- 用户收到发布成功通知

### 🔍 标签搜索功能
- 用户在群组中输入 `#标签` 即可搜索
- 支持多标签组合搜索（如 `#龙岗 #竹竹`）
- 显示匹配的报告列表（最多 10 份）
- 快速预览报告信息和查看完整内容

### 🛠️ 完整的管理员菜单
- **快速评价管理**：查看排行榜、搜索教师、删除数据
- **报告审核**：审核待审核报告、查看预约截图、通过/驳回
- **频道管理**：强制订阅频道、报告推送频道
- **用户管理**：黑名单管理
- **模板管理**：编辑字段显示名称和顺序、自定义模板头部/尾部、预定义标签维护

## 📁 项目结构

```
handlers/
├── mention.py           # 统计卡片查询和快速操作
├── report_form.py       # 报告表单处理（预约截图+标签）
├── quick_rate.py        # 快速评价逻辑
├── admin.py             # 管理员菜单和审核功能
├── template.py          # 报告模板管理系统
├── search.py            # 标签搜索功能
└── menu.py              # 主菜单系统

main.py                  # 应用入口
database.py              # 数据库操作和查询
config.py                # 配置管理
states.py                # FSM 状态定义
bot_instance.py          # 机器人实例
requirements.txt         # Python 依赖包
.env.example             # 环境变量示例
railway.json             # Railway 部署配置
```

## 🚀 快速开始

### 本地运行

```bash
# 1. 安装依赖
pip install -r requirements.txt

# 2. 配置环境变量
cp .env.example .env
# 编辑 .env，填入 BOT_TOKEN 和 ADMIN_IDS

# 3. 启动机器人
python main.py
```

### Railway 部署

1. Fork 或 Clone 本仓库
2. 在 [Railway](https://railway.app) 创建新项目
3. 连接 GitHub 仓库
4. 设置环境变量（见下方说明）
5. 部署完成！

> ⚠️ **重要：Railway 部署数据持久化**
>
> Railway 等容器平台的文件系统是**临时的（Ephemeral）**，容器重启或重新部署后 SQLite 数据库文件会丢失，
> 导致所有通过管理后台配置的内容（频道、模板字段、预定义标签、欢迎文本等）消失。
>
> **解决方案（推荐）**：在 Railway 中添加 PostgreSQL 插件，然后设置以下环境变量：
> ```env
> DATABASE_TYPE=postgresql
> DATABASE_URL=postgresql://user:password@host:5432/database_name
> ```
> Railway PostgreSQL 插件会自动提供 `DATABASE_URL` 变量，将其值复制并设置 `DATABASE_TYPE=postgresql` 即可。

## 🔑 环境变量

| 变量名 | 必填 | 说明 | 示例 |
|--------|------|------|------|
| `BOT_TOKEN` | ✅ | Telegram Bot Token | `123456:ABCDEF...` |
| `ADMIN_IDS` | ✅ | 管理员 ID，逗号分隔 | `123456789,987654321` |
| `DATABASE_TYPE` | ⬜ | 数据库类型 (sqlite/mysql/postgresql) | `sqlite` |
| `REQUIRED_CHANNELS` | ⬜ | 强制订阅频道 ID，逗号分隔 | `-1001234567890` |
| `REPORT_CHANNELS` | ⬜ | 报告推送频道 ID，逗号分隔 | `-1001234567890` |
| `LOG_LEVEL` | ⬜ | 日志级别 | `INFO` |
| `ENVIRONMENT` | ⬜ | 运行环境 | `production` |
| `MIN_REASON_LENGTH` | ⬜ | 评价理由最小字数 | `12` |
| `MIN_SCREENSHOTS` | ⬜ | 预约截图最小数量 | `1` |
| `MAX_SCREENSHOTS` | ⬜ | 预约截图最大数量 | `3` |

### 获取 BOT_TOKEN

1. 打开 Telegram，搜索 `@BotFather`
2. 发送 `/newbot`
3. 按步骤创建机器人
4. 复制获得的 Token

### 获取管理员 ID

1. 给机器人发送 `/start`
2. 使用 `@userinfobot` 获取自己的用户 ID
3. 将 ID 填入 `ADMIN_IDS`

### 获取频道 ID

1. 在频道中发一条消息
2. 转发给 `@userinfobot`
3. 获取频道 ID（格式：`-100XXXXXXXXX`）

## 💾 数据库支持

### SQLite（默认，适合小型部署）

```env
DATABASE_TYPE=sqlite
SQLITE_DB_PATH=data/bot.db
```

### PostgreSQL（推荐用于生产环境）

```env
DATABASE_TYPE=postgresql
DATABASE_URL=postgresql://user:password@host:5432/database_name
```

### MySQL

```env
DATABASE_TYPE=mysql
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=root
MYSQL_PASSWORD=your_password
MYSQL_DATABASE=yhq_db
```

## 🔄 完整工作流程

```
用户查询 @用户名
    ↓
显示统计卡片（推荐数、不推荐数）
    ├─ 点击【👍推荐】或【👎不推荐】
    │   ↓
    │   输入一句话理由
    │   ↓
    │   立即保存（系统 A）
    │
    ├─ 点击【📝写报告】
    │   ↓
    │   逐步填写表单字段
    │   ↓
    │   上传预约截图（必填）
    │   ↓
    │   输入标签（可选）
    │   ↓
    │   预览和提交（系统 B）
    │   ↓
    │   管理员审核
    │   ↓
    │   通过 → 推送到频道 + 通知用户
    │
    └─ 搜索标签 #标签
        ↓
        显示匹配的报告列表
        ↓
        查看报告详情
```

## 🔐 安全特性

- 管理员权限验证
- 频道访问权限检查
- 用户黑名单系统
- 数据库操作规范化
- 错误日志记录

## 📚 依赖包

- `aiogram>=3.0.0` — Telegram Bot 框架
- `python-dotenv>=1.0.0` — 环境变量管理
- `aiosqlite>=0.19.0` — SQLite 异步驱动
- `asyncpg>=0.28.0` — PostgreSQL 异步驱动
- `aiomysql>=0.2.0` — MySQL 异步驱动

## 📄 License

MIT License
