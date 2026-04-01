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

    app = FastAPI(
        title="Report System API",
        description="企业级报告系统 REST API",
        version="2.0.0",
        docs_url="/docs",
        redoc_url="/redoc",
        openapi_url="/openapi.json",
    )

    # CORS 中间件
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # 注册路由
    app.include_router(health.router, tags=["健康检查"])
    app.include_router(auth.router, prefix="/api/v1/auth", tags=["认证"])
    app.include_router(reports.router, prefix="/api/v1/reports", tags=["报告"])
    app.include_router(users.router, prefix="/api/v1/users", tags=["用户"])
    app.include_router(admin.router, prefix="/api/v1/admin", tags=["管理"])
    app.include_router(miniapp.router, prefix="/miniapp", tags=["miniapp"])

    @app.on_event("startup")
    async def startup_event():
        logger.info("API 服务已启动")

    @app.on_event("shutdown")
    async def shutdown_event():
        logger.info("API 服务已关闭")

    return app


def run_api():
    """运行 API 服务"""
    try:
        import uvicorn
    except ImportError:
        logger.error("uvicorn 未安装，无法启动 API 服务。运行: pip install uvicorn")
        return

    from core.config import core_config

    app = create_app()
    if app is None:
        return

    uvicorn.run(
        app,
        host=core_config.API_HOST,
        port=core_config.API_PORT,
        log_level=core_config.LOG_LEVEL.lower(),
    )
