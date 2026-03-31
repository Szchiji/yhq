"""
限流服务
封装 utils.rate_limiter 的限流功能
"""
import logging
from typing import Optional, Tuple

logger = logging.getLogger(__name__)


class RateLimiterService:
    """限流业务服务"""

    def __init__(self):
        from utils.rate_limiter import RateLimiter
        self._limiter = RateLimiter()

    async def check_user(
        self,
        user_id: int,
        action: str,
        max_requests: int = 10,
        time_window_seconds: int = 60,
    ) -> Tuple[bool, Optional[str]]:
        return await self._limiter.check_user_rate_limit(
            user_id, action, max_requests, time_window_seconds
        )

    async def check_ip(
        self,
        ip: str,
        max_requests: int = 100,
        time_window_seconds: int = 60,
    ) -> Tuple[bool, Optional[str]]:
        return await self._limiter.check_ip_rate_limit(ip, max_requests, time_window_seconds)

    async def check_brute_force(
        self,
        user_id: int,
        failed: bool,
        max_failed_attempts: int = 5,
    ) -> Tuple[bool, Optional[str]]:
        return await self._limiter.check_brute_force_protection(
            user_id, failed, max_failed_attempts
        )

    async def unlock_user(self, user_id: int) -> bool:
        return await self._limiter.unlock_user(user_id)

    async def get_stats(self) -> dict:
        return await self._limiter.get_rate_limit_stats()

    async def get_remaining_requests(
        self, user_id: int, action: str, max_requests: int = 10
    ) -> int:
        return await self._limiter.get_user_remaining_requests(
            user_id, action, max_requests
        )


# 全局实例
rate_limiter_service = RateLimiterService()
