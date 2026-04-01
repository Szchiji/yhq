"""
缓存服务
封装 utils.cache 的缓存功能
"""
import logging
from typing import Any, Callable, Optional

logger = logging.getLogger(__name__)


class CacheService:
    """缓存业务服务"""

    def __init__(self):
        from utils.cache import CacheManager
        self._manager = CacheManager()

    async def get(self, key: str) -> Optional[Any]:
        return await self._manager.get(key)

    async def set(self, key: str, value: Any, ttl_seconds: int = 300):
        await self._manager.set(key, value, ttl_seconds)

    async def delete(self, key: str) -> bool:
        return await self._manager.delete(key)

    async def get_or_set(
        self,
        key: str,
        factory: Callable,
        ttl_seconds: int = 300,
    ) -> Any:
        return await self._manager.get_or_set(key, factory, ttl_seconds)

    async def invalidate_prefix(self, prefix: str):
        await self._manager.invalidate_prefix(prefix)

    def stats(self) -> dict:
        return self._manager.stats()


# 全局实例
cache_service = CacheService()
