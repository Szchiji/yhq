# 部署指南

## 本地开发

### 前提条件
- Python 3.11+
- pip

### 安装步骤

```bash
# 1. 克隆仓库
git clone https://github.com/Szchiji/yhq.git
cd yhq

# 2. 安装依赖
pip install -r requirements.txt

# 3. 配置环境变量
cp .env.example .env
# 编辑 .env 文件，设置 BOT_TOKEN 和 ADMIN_IDS

# 4. 启动机器人
python main.py
```

---

## Docker 部署

### 使用 Docker Compose（推荐）

```bash
# 1. 复制配置
cp .env.example .env
# 编辑 .env

# 2. 启动服务
docker-compose up -d

# 3. 查看日志
docker-compose logs -f bot

# 4. 停止服务
docker-compose down
```

### 使用 Dockerfile

```bash
# 构建镜像
docker build -t yhq-bot .

# 运行容器
docker run -d \
  --name yhq_bot \
  --env-file .env \
  -v $(pwd)/data:/app/data \
  -v $(pwd)/backups:/app/backups \
  yhq-bot
```

---

## 生产环境配置建议

1. **使用 PostgreSQL** 替代 SQLite：
   ```
   DATABASE_TYPE=postgresql
   DATABASE_URL=postgresql://user:password@host:5432/yhq_db
   ```

2. **启用 Redis 缓存**：
   ```
   REDIS_URL=redis://redis:6379/0
   ```

3. **设置强密钥**：
   ```
   JWT_SECRET_KEY=$(python -c "import secrets; print(secrets.token_hex(32))")
   ENCRYPTION_KEY=$(python -c "import secrets; print(secrets.token_bytes(32).hex())")
   ```

4. **配置 Webhook 模式**：
   ```
   BOT_MODE=webhook
   WEBHOOK_URL=https://your-domain.com
   ```

---

## Railway 部署

在 Railway 中，直接设置环境变量即可。建议使用 PostgreSQL 插件而非 SQLite。
