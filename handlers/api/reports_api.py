"""
REST API 处理模块
提供报告相关的 REST API 接口
"""

import json
import logging
from datetime import datetime, timezone
from typing import Optional

from aiohttp import web

logger = logging.getLogger(__name__)

# API 路由
router = web.RouteTableDef()


def _json_response(data: dict, status: int = 200) -> web.Response:
    """返回 JSON 响应"""
    return web.Response(
        text=json.dumps(data, ensure_ascii=False),
        content_type="application/json",
        status=status,
    )


def _error_response(message: str, status: int = 400) -> web.Response:
    """返回错误 JSON 响应"""
    return _json_response({"error": message, "success": False}, status)


async def _check_api_key(request: web.Request) -> Optional[str]:
    """验证 API 密钥，返回错误消息或 None（验证通过）"""
    import os
    api_key = os.getenv("API_KEY")
    if not api_key:
        return None  # 未配置 API 密钥，允许所有请求
    provided = request.headers.get("X-API-Key") or request.rel_url.query.get("api_key")
    if provided != api_key:
        return "Invalid or missing API key"
    return None


# ============================================================
# 健康检查
# ============================================================

@router.get("/api/v1/health")
async def health_check(request: web.Request) -> web.Response:
    """健康检查端点"""
    return _json_response({
        "status": "healthy",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "version": "1.0.0",
    })


# ============================================================
# 统计 API
# ============================================================

@router.get("/api/v1/stats")
async def get_stats(request: web.Request) -> web.Response:
    """获取统计摘要"""
    err = await _check_api_key(request)
    if err:
        return _error_response(err, 401)
    try:
        from utils.analytics import analytics_service
        stats = await analytics_service.get_report_stats(days=7)
        user_stats = await analytics_service.get_user_stats()
        return _json_response({
            "success": True,
            "data": {
                "reports": stats,
                "users": user_stats,
            },
        })
    except Exception as e:
        logger.error(f"获取统计失败：{e}")
        return _error_response("Internal server error", 500)


# ============================================================
# 报告 API
# ============================================================

@router.get("/api/v1/reports")
async def list_reports(request: web.Request) -> web.Response:
    """列出报告"""
    err = await _check_api_key(request)
    if err:
        return _error_response(err, 401)
    try:
        from database import get_db
        status = request.rel_url.query.get("status")
        limit = min(int(request.rel_url.query.get("limit", "20")), 100)
        offset = int(request.rel_url.query.get("offset", "0"))

        db = await get_db()
        query = "SELECT id, user_id, teacher_name, status, created_at FROM reports WHERE 1=1"
        params = []
        if status:
            query += " AND status = ?"
            params.append(status)
        query += " ORDER BY created_at DESC LIMIT ? OFFSET ?"
        params.extend([limit, offset])

        cursor = await db.execute(query, params)
        rows = await cursor.fetchall()
        reports = [
            {
                "id": row["id"],
                "user_id": row["user_id"],
                "teacher_name": row["teacher_name"],
                "status": row["status"],
                "created_at": row["created_at"],
            }
            for row in rows
        ]
        return _json_response({"success": True, "data": reports, "count": len(reports)})
    except Exception as e:
        logger.error(f"列出报告失败：{e}")
        return _error_response("Internal server error", 500)


@router.get("/api/v1/reports/{report_id}")
async def get_report(request: web.Request) -> web.Response:
    """获取单个报告详情"""
    err = await _check_api_key(request)
    if err:
        return _error_response(err, 401)
    try:
        report_id = int(request.match_info["report_id"])
        from database import get_db
        db = await get_db()
        cursor = await db.execute(
            "SELECT id, user_id, teacher_name, status, created_at FROM reports WHERE id = ?",
            (report_id,),
        )
        row = await cursor.fetchone()
        if not row:
            return _error_response("Report not found", 404)
        return _json_response({
            "success": True,
            "data": {
                "id": row["id"],
                "user_id": row["user_id"],
                "teacher_name": row["teacher_name"],
                "status": row["status"],
                "created_at": row["created_at"],
            },
        })
    except ValueError:
        return _error_response("Invalid report ID", 400)
    except Exception as e:
        logger.error(f"获取报告失败：{e}")
        return _error_response("Internal server error", 500)


# ============================================================
# 搜索 API
# ============================================================

@router.get("/api/v1/search")
async def search_reports(request: web.Request) -> web.Response:
    """搜索报告"""
    err = await _check_api_key(request)
    if err:
        return _error_response(err, 401)
    try:
        query = request.rel_url.query.get("q", "").strip()
        if not query:
            return _error_response("搜索关键词不能为空", 400)
        limit = min(int(request.rel_url.query.get("limit", "20")), 100)
        offset = int(request.rel_url.query.get("offset", "0"))

        from utils.search_service import search_service
        result = await search_service.search_reports(query, limit=limit, offset=offset)
        return _json_response({"success": True, **result})
    except Exception as e:
        logger.error(f"搜索失败：{e}")
        return _error_response("Internal server error", 500)


# ============================================================
# 数据导出 API
# ============================================================

@router.get("/api/v1/export/reports.csv")
async def export_reports_csv(request: web.Request) -> web.Response:
    """导出报告为 CSV"""
    err = await _check_api_key(request)
    if err:
        return _error_response(err, 401)
    try:
        from utils.analytics import analytics_service
        status = request.rel_url.query.get("status")
        days_str = request.rel_url.query.get("days")
        days = int(days_str) if days_str else None
        csv_bytes = await analytics_service.export_reports_csv(status=status, days=days)
        return web.Response(
            body=csv_bytes,
            content_type="text/csv",
            headers={"Content-Disposition": "attachment; filename=reports.csv"},
        )
    except Exception as e:
        logger.error(f"导出 CSV 失败：{e}")
        return _error_response("Internal server error", 500)


@router.get("/api/v1/export/stats.json")
async def export_stats_json(request: web.Request) -> web.Response:
    """导出统计数据为 JSON"""
    err = await _check_api_key(request)
    if err:
        return _error_response(err, 401)
    try:
        from utils.analytics import analytics_service
        json_bytes = await analytics_service.export_stats_json()
        return web.Response(
            body=json_bytes,
            content_type="application/json",
            headers={"Content-Disposition": "attachment; filename=stats.json"},
        )
    except Exception as e:
        logger.error(f"导出 JSON 失败：{e}")
        return _error_response("Internal server error", 500)


def create_api_app() -> web.Application:
    """创建 API aiohttp 应用"""
    app = web.Application()
    app.add_routes(router)
    return app
