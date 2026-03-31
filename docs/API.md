# API 文档

## 概览

本项目提供可选的 REST API 接口，通过设置 `API_ENABLED=true` 启用。

**基础 URL：** `http://localhost:8080`

**认证：** 在请求头中传入 `X-API-Key: <your_api_key>`，或在 URL 中附加 `?api_key=<your_api_key>`。

---

## 端点列表

### 健康检查

```
GET /api/v1/health
```

**响应示例：**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00+00:00",
  "version": "1.0.0"
}
```

---

### 统计数据

```
GET /api/v1/stats
```

**响应示例：**
```json
{
  "success": true,
  "data": {
    "reports": {
      "total_reports": 100,
      "reports_last_n_days": 10,
      "approved_reports": 80,
      "pending_reports": 5,
      "approval_rate": 80.0,
      "period_days": 7
    },
    "users": {
      "total_users": 50,
      "blacklisted_users": 2,
      "active_users": 48
    }
  }
}
```

---

### 报告列表

```
GET /api/v1/reports
```

**查询参数：**
- `status` - 过滤状态：`pending` / `approved` / `rejected`
- `limit` - 每页数量（最大 100，默认 20）
- `offset` - 偏移量（默认 0）

---

### 报告详情

```
GET /api/v1/reports/{report_id}
```

---

### 搜索报告

```
GET /api/v1/search?q={keyword}
```

**查询参数：**
- `q` - 搜索关键词（必填）
- `limit` - 结果数量（最大 100，默认 20）
- `offset` - 偏移量（默认 0）

---

### 数据导出

```
GET /api/v1/export/reports.csv
GET /api/v1/export/stats.json
```

**查询参数（CSV）：**
- `status` - 过滤状态
- `days` - 最近 N 天

---

## 错误响应格式

```json
{
  "error": "错误描述",
  "success": false
}
```

**HTTP 状态码：**
- `200` - 成功
- `400` - 请求参数错误
- `401` - 未授权
- `404` - 资源不存在
- `500` - 服务器内部错误
