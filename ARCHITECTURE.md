# 系统架构文档

## 概述

本系统是一个企业级 Telegram 机器人报告系统，采用分层架构设计，支持 SQLite、PostgreSQL 和 MySQL 数据库，具备完整的缓存、限流、备份和通知功能。

## 目录结构

```
yhq/
├── bot/                    # Bot 子模块（处理器、工具）
├── core/                   # 核心模块（配置、Bot 生命周期）
├── models/                 # 数据模型（User、Report、Template）
├── services/               # 业务服务层
├── report_system/          # 企业级报告系统（扩展服务）
├── handlers/               # Telegram 消息处理器
├── utils/                  # 工具函数（认证、缓存、限流等）
├── api/                    # REST API（FastAPI）
├── miniapp/                # Web 前端应用
├── database/               # 数据库 schema
├── i18n/                   # 国际化
├── config/                 # 扩展配置
├── docker/                 # Docker 编排配置
├── tests/                  # 测试套件
├── docs/                   # 详细文档
├── logs/                   # 日志目录
├── backups/                # 备份目录
├── data/                   # 数据目录
├── main.py                 # 应用入口
├── config.py               # 基础配置
├── database.py             # 数据库操作
├── states.py               # FSM 状态定义
├── bot_instance.py         # Bot 实例
├── Dockerfile              # Docker 镜像
├── docker-compose.yml      # Docker Compose
├── requirements.txt        # Python 依赖
└── railway.json            # Railway 部署配置
```

## 架构层次

### 1. 表示层（Handlers）

`handlers/` 目录包含所有 Telegram 消息处理器：

- `menu.py` - 主菜单导航
- `admin.py` - 管理员操作
- `report_form.py` - 报告表单流程
- `quick_rate.py` - 快速评价
- `mention.py` - @mention 统计查询
- `mention_report.py` - @mention 报告列表
- `search.py` - 标签搜索
- `template.py` - 模板管理
- `broadcast.py` - 广播系统
- `settings.py` - 设置管理

### 2. 业务服务层（Services）

`services/` 目录提供业务逻辑封装：

- `auth_service.py` - JWT 认证、密码管理、API 密钥
- `cache_service.py` - 内存/Redis 缓存
- `notification_service.py` - Telegram/邮件通知
- `rate_limiter_service.py` - 用户/IP 限流
- `analytics_service.py` - 数据统计分析
- `search_service.py` - 全文搜索
- `backup_service.py` - 数据备份恢复
- `report_service.py` - 报告业务逻辑
- `user_service.py` - 用户管理

### 3. 企业服务层（Report System）

`report_system/services/` 提供扩展的企业级功能：

- 刷新令牌机制
- API 密钥管理
- 批量操作
- 仪表盘数据聚合
- 计划备份

### 4. 数据访问层（Database）

`database.py` 支持三种数据库：

- **SQLite**（默认，本地开发）
- **PostgreSQL**（推荐生产环境）
- **MySQL**（可选）

### 5. REST API 层（API）

`api/` 目录提供 FastAPI REST 接口：

- `GET /health` - 健康检查
- `POST /api/v1/auth/token` - 获取访问令牌
- `GET /api/v1/reports/` - 报告列表
- `GET /api/v1/reports/ranking` - 排行榜
- `GET /api/v1/reports/stats` - 统计数据
- `POST /api/v1/reports/{id}/approve` - 审核通过
- `POST /api/v1/reports/{id}/reject` - 拒绝报告
- `GET /api/v1/users/{id}` - 用户信息
- `GET /api/v1/admin/stats` - 管理统计
- `GET /miniapp/` - Web 应用

### 6. Web 前端（miniapp）

`miniapp/` 是基于 Vanilla JS 的单页应用：

- 首页（排行榜摘要）
- 查询页（搜索教师）
- 提交页（引导到 Bot）
- 统计页（完整排行榜）
- 个人资料页（认证管理）

## 安全设计

1. **认证**：JWT 令牌（HMAC-SHA256）+ API 密钥
2. **密码**：PBKDF2-SHA256（260000 次迭代）
3. **限流**：用户级别 + IP 级别双重保护
4. **防暴力破解**：连续失败自动锁定
5. **加密**：敏感数据可选加密存储

## 数据流

```
Telegram 用户
    ↓ 发送消息
Aiogram 路由
    ↓
Handler（handlers/）
    ↓ 业务逻辑
Service（services/）
    ↓ 数据访问
Database（database.py）
    ↓
SQLite / PostgreSQL / MySQL
```

## 部署方案

### 开发环境
- SQLite 数据库
- 内存缓存
- Polling 模式

### 生产环境
- PostgreSQL 数据库
- Redis 缓存
- Webhook 模式（或 Polling）
- Docker Compose / Railway

## 扩展性

系统设计为可扩展：

1. **数据库**：通过 `DATABASE_TYPE` 切换
2. **缓存**：通过 `CACHE_BACKEND` 切换 memory/redis
3. **搜索**：通过 `ELASTICSEARCH_ENABLED` 启用 ES
4. **API**：通过 `API_ENABLED` 启用 REST API
5. **国际化**：通过 `DEFAULT_LANGUAGE` 设置语言
