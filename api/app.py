"""
FastAPI 主应用
提供 REST API 服务
"""
import logging
import os
from datetime import datetime, timezone
from typing import Any, Dict

logger = logging.getLogger(__name__)


def create_app():
    """创建并配置 FastAPI 应用"""
    try:
        from fastapi import FastAPI
        from fastapi.middleware.cors import CORSMiddleware
    except ImportError:
        logger.warning("FastAPI 未安装，API 服务不可用。运行: pip install fastapi uvicorn")
        return None

    from api.routes import auth, reports, users, admin, health, miniapp

    _app = FastAPI(
        title="Report System API",
        description="报告管理系统 REST API",
        version="2.0.0",
        docs_url="/docs",
        redoc_url="/redoc",
        openapi_url="/openapi.json",
    )

    # CORS 中间件
    cors_origins = os.getenv("CORS_ORIGINS", "*").split(",")
    _app.add_middleware(
        CORSMiddleware,
        allow_origins=cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # 注册路由
    _app.include_router(health.router, tags=["健康检查"])
    _app.include_router(auth.router, prefix="/api/v1/auth", tags=["认证"])
    _app.include_router(reports.router, prefix="/api/v1/reports", tags=["报告"])
    _app.include_router(users.router, prefix="/api/v1/users", tags=["用户"])
    _app.include_router(admin.router, prefix="/api/v1/admin", tags=["管理"])
    _app.include_router(miniapp.router, prefix="/miniapp", tags=["miniapp"])

    @_app.on_event("startup")
    async def startup_event():
        logger.info("API 服务已启动")

    @_app.on_event("shutdown")
    async def shutdown_event():
        logger.info("API 服务已关闭")

    return _app


# 模块级 app 实例，供 uvicorn 直接使用
app = create_app()


def run_api():
    """运行 API 服务"""
    try:
        import uvicorn
    except ImportError:
        logger.error("uvicorn 未安装，无法启动 API 服务。运行: pip install uvicorn")
        return

    host = os.getenv("API_HOST", "0.0.0.0")
    port = int(os.getenv("API_PORT", "8000"))
    log_level = os.getenv("LOG_LEVEL", "info").lower()

    uvicorn.run(
        app,
        host=host,
        port=port,
        log_level=log_level,
    )
