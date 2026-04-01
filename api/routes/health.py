"""
健康检查路由
"""
import logging
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

try:
    from fastapi import APIRouter
    router = APIRouter()

    @router.get("/health")
    async def health_check():
        """健康检查端点"""
        return {
            "status": "ok",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "service": "Report System API",
        }

    @router.get("/")
    async def root():
        """根路径"""
        return {
            "message": "Report System API",
            "version": "2.0.0",
            "docs": "/docs",
        }

except ImportError:
    router = None
    logger.warning("FastAPI 未安装，健康检查路由不可用")
