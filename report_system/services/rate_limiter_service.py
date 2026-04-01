"""
企业级限流服务
"""
import logging
from typing import Optional, Tuple

logger = logging.getLogger(__name__)


class RateLimiterServiceEnterprise:
    """企业级限流服务"""

    def __init__(self):
        from services.rate_limiter_service import RateLimiterService
        self._base = RateLimiterService()

    async def check_submit_report(self, user_id: int) -> Tuple[bool, Optional[str]]:
        """检查提交报告限流"""
        from core.config import core_config
        return await self._base.check_user(
            user_id,
            "submit_report",
            max_requests=core_config.RATE_LIMIT_SUBMIT_REPORT,
            time_window_seconds=60,
        )

    async def check_search(self, user_id: int) -> Tuple[bool, Optional[str]]:
        """检查搜索限流"""
        from core.config import core_config
        return await self._base.check_user(
            user_id,
            "search",
            max_requests=core_config.RATE_LIMIT_SEARCH,
            time_window_seconds=60,
        )

    async def check_api(self, ip: str) -> Tuple[bool, Optional[str]]:
        """检查 API 限流"""
        from core.config import core_config
        return await self._base.check_ip(
            ip,
            max_requests=core_config.RATE_LIMIT_API,
            time_window_seconds=60,
        )

    async def unlock_user(self, user_id: int) -> bool:
        return await self._base.unlock_user(user_id)

    async def get_stats(self) -> dict:
        return await self._base.get_stats()
