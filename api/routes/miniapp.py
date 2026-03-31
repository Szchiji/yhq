"""
miniapp 路由
为 Web miniapp 提供数据接口
"""
import logging

logger = logging.getLogger(__name__)

try:
    from fastapi import APIRouter, HTTPException, Query
    from fastapi.responses import HTMLResponse

    router = APIRouter()

    @router.get("/", response_class=HTMLResponse)
    async def miniapp_index():
        """miniapp 主页"""
        return HTMLResponse(
            content="""
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Report System</title>
    <style>
        body { font-family: sans-serif; text-align: center; padding: 40px; }
        h1 { color: #2d6cdf; }
    </style>
</head>
<body>
    <h1>📊 Report System</h1>
    <p>企业级报告系统 Web 界面</p>
    <p><a href="/docs">API 文档</a></p>
</body>
</html>
""",
            status_code=200,
        )

    @router.get("/api/ranking")
    async def api_ranking(limit: int = Query(10, ge=1, le=50)):
        """公开排行榜 API"""
        from services.report_service import report_service
        ranking = await report_service.get_ranking(limit=limit)
        return {"ranking": ranking}

    @router.get("/api/search")
    async def api_search(
        q: str = Query("", min_length=1),
        limit: int = Query(10, ge=1, le=50),
    ):
        """公开搜索 API"""
        from services.search_service import search_service
        results = await search_service.search_teachers(q, limit=limit)
        return results

except ImportError:
    router = None
    logger.warning("FastAPI 未安装，miniapp 路由不可用")
