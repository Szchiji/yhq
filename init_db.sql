-- 创建白名单表
CREATE TABLE IF NOT EXISTS whitelist (
    user_id BIGINT PRIMARY KEY,
    expires_at TIMESTAMP
);

-- 创建封禁列表表
CREATE TABLE IF NOT EXISTS banlist (
    user_id BIGINT PRIMARY KEY
);

-- 创建模板配置表
CREATE TABLE IF NOT EXISTS config (
    id SERIAL PRIMARY KEY,
    template TEXT
);
