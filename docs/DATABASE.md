# 数据库变更说明

## 新增表结构

### `audit_logs` - 审计日志表
记录所有用户和管理员操作。

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER | 主键 |
| user_id | INTEGER | 操作用户 ID |
| action | TEXT | 操作类型 |
| resource | TEXT | 操作资源 |
| resource_id | TEXT | 资源 ID |
| details | TEXT | JSON 格式详情 |
| success | INTEGER | 是否成功（1/0）|
| ip | TEXT | IP 地址 |
| created_at | TEXT | 创建时间 |

### `api_keys` - API 密钥表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER | 主键 |
| user_id | INTEGER | 所属用户 |
| key_hash | TEXT | 密钥哈希（唯一）|
| name | TEXT | 密钥名称 |
| is_active | INTEGER | 是否启用（1/0）|
| last_used_at | TEXT | 最后使用时间 |
| created_at | TEXT | 创建时间 |
| expires_at | TEXT | 过期时间 |

### `users` 表新增字段
- `language` - 用户语言偏好（默认 `zh`）

---

## 新增索引

- `idx_reports_status` - 报告状态索引
- `idx_reports_teacher_name` - 教师姓名索引
- `idx_reports_user_id` - 用户 ID 索引
- `idx_reports_created_at` - 创建时间索引
- `idx_audit_user_id` - 审计用户索引
- `idx_audit_action` - 审计操作索引
- `idx_audit_created_at` - 审计时间索引
- `idx_api_keys_user_id` - API 密钥用户索引
- `idx_api_keys_hash` - API 密钥哈希索引

---

## 兼容性说明

所有表和索引使用 `CREATE TABLE IF NOT EXISTS` 和 `CREATE INDEX IF NOT EXISTS`，
对现有数据库完全向后兼容，无需手动迁移。
