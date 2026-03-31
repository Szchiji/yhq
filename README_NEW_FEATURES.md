# 新功能概览

## 企业级功能模块

本次更新为系统添加了 12 个企业级功能模块，同时保持对现有功能的完全向后兼容。

---

## 核心功能

### 1. 认证系统 (`utils/auth.py`)
- JWT 令牌生成和验证（HMAC-SHA256，无额外依赖）
- 密码安全哈希（PBKDF2-SHA256，260000 次迭代）
- API 密钥生成和验证
- 内存会话管理

### 2. 日志系统 (`utils/logging_service.py`)
- 审计日志（记录用户操作）
- 错误追踪器
- 性能监控（操作耗时统计）

### 3. 缓存系统 (`utils/cache.py`)
- 内存缓存（带 TTL 支持）
- Redis 缓存（需配置 `REDIS_URL`）
- `get_or_set` 模式自动缓存

### 4. 限流防护 (`utils/rate_limiter.py`)
- 用户级别限流（可配置时间窗口和上限）
- IP 级别限流
- 防暴力破解（连续失败锁定）
- 防重复提交

### 5. 通知系统 (`utils/notifications.py`)
- Telegram 通知（向管理员或用户发送消息）
- 邮件通知（SMTP，可选）
- 异步通知队列

### 6. 备份恢复 (`utils/backup_service.py`)
- 自动定时备份
- 备份压缩（ZIP 格式）
- 可选加密备份（Fernet）
- 备份恢复

### 7. 数据分析 (`utils/analytics.py`)
- 报告统计（总数、审核率、趋势）
- 用户统计
- 教师排行
- 数据导出（CSV、JSON）

### 8. 搜索功能 (`utils/search_service.py`)
- 本地全文搜索（基于数据库 LIKE 查询）
- Elasticsearch 集成（可选，配置 `ELASTICSEARCH_URL`）
- 教师搜索

### 9. 加密安全 (`utils/encryption.py`)
- AES-256-GCM 加密（需 cryptography 包，否则自动回退）
- SHA-256/SHA-512 哈希
- HMAC 签名
- 数据脱敏

---

## 扩展功能

### 10. 国际化 (`i18n/i18n_service.py`)
- 内置中文、英文、日文翻译
- 用户语言偏好设置
- 动态添加翻译支持

### 11. REST API (`handlers/api/reports_api.py`)
- 报告查询和搜索接口
- 统计数据接口
- 数据导出接口（CSV、JSON）
- API 密钥认证

### 12. Docker 部署
- `Dockerfile` - 生产镜像
- `docker-compose.yml` - 包含 Redis 的完整编排

---

## 快速开始

```bash
# 安装依赖
pip install -r requirements.txt

# 复制配置
cp .env.example .env
# 编辑 .env，至少设置 BOT_TOKEN 和 ADMIN_IDS

# 启动（默认 Polling 模式）
python main.py

# 或使用 Docker
docker-compose up -d
```

## 运行测试

```bash
pip install pytest pytest-asyncio
pytest tests/ -v
```
