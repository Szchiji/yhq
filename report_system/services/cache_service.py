"""
企业级缓存服务
"""
import logging
from typing import Any, Callable, Optional

logger = logging.getLogger(__name__)


class CacheServiceEnterprise:
    """企业级缓存服务"""

    def __init__(self):
        from services.cache_service import CacheService
        self._base = CacheService()

    async def get(self, key: str) -> Optional[Any]:
        return await self._base.get(key)

    async def set(self, key: str, value: Any, ttl_seconds: int = 300):
        await self._base.set(key, value, ttl_seconds)

    async def delete(self, key: str) -> bool:
        return await self._base.delete(key)

    async def get_or_set(
        self, key: str, factory: Callable, ttl_seconds: int = 300
    ) -> Any:
        return await self._base.get_or_set(key, factory, ttl_seconds)

    async def cache_report(self, report_id: int, data: dict, ttl: int = 600):
        """缓存报告数据"""
        await self.set(f"report:{report_id}", data, ttl)

    async def get_cached_report(self, report_id: int) -> Optional[dict]:
        """获取缓存的报告"""
        return await self.get(f"report:{report_id}")

    async def invalidate_report(self, report_id: int):
        """使报告缓存失效"""
        await self.delete(f"report:{report_id}")

    async def invalidate_user_cache(self, user_id: int):
        """使用户相关缓存失效"""
        await self._base.invalidate_prefix(f"user:{user_id}:")
