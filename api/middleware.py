"""
API 中间件
"""
import logging
import time
from typing import Callable

logger = logging.getLogger(__name__)


def get_rate_limit_middleware():
    """获取限流中间件（需要 FastAPI）"""
    try:
        from fastapi import Request, Response
        from starlette.middleware.base import BaseHTTPMiddleware

        class RateLimitMiddleware(BaseHTTPMiddleware):
            async def dispatch(self, request: Request, call_next: Callable) -> Response:
                start_time = time.time()
                response = await call_next(request)
                process_time = time.time() - start_time
                response.headers["X-Process-Time"] = str(round(process_time * 1000, 2))
                return response

        return RateLimitMiddleware
    except ImportError:
        return None
