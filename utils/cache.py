"""
缓存系统模块
支持内存缓存和 Redis 缓存（可选）
"""

import asyncio
import logging
import os
import time
from typing import Any, Callable, Optional

logger = logging.getLogger(__name__)


class MemoryCache:
    """内存缓存，带 TTL 支持"""

    def __init__(self):
        self._store: dict = {}
        self._expiry: dict = {}

    def get(self, key: str) -> Optional[Any]:
        """获取缓存值，若过期返回 None"""
        expiry = self._expiry.get(key)
        if expiry is not None and time.time() > expiry:
            self.delete(key)
            return None
        return self._store.get(key)

    def set(self, key: str, value: Any, ttl_seconds: int = 300):
        """设置缓存值，带 TTL（秒）"""
        self._store[key] = value
        if ttl_seconds > 0:
            self._expiry[key] = time.time() + ttl_seconds
        elif key in self._expiry:
            del self._expiry[key]

    def delete(self, key: str) -> bool:
        """删除缓存键"""
        self._store.pop(key, None)
        self._expiry.pop(key, None)
        return True

    def exists(self, key: str) -> bool:
        """检查键是否存在且未过期"""
        return self.get(key) is not None

    def clear(self):
        """清空所有缓存"""
        self._store.clear()
        self._expiry.clear()

    def cleanup_expired(self) -> int:
        """清理过期条目，返回清理数量"""
        now = time.time()
        expired_keys = [k for k, exp in self._expiry.items() if now > exp]
        for key in expired_keys:
            self.delete(key)
        return len(expired_keys)

    def size(self) -> int:
        """获取当前缓存条目数"""
        self.cleanup_expired()
        return len(self._store)

    def stats(self) -> dict:
        """获取缓存统计信息"""
        self.cleanup_expired()
        return {
            "size": len(self._store),
            "keys_with_ttl": len(self._expiry),
        }


class RedisCache:
    """Redis 缓存（需要安装 redis 包）"""

    def __init__(self, url: str):
        self._url = url
        self._client = None

    async def _get_client(self):
        if self._client is None:
            try:
                import redis.asyncio as aioredis
                self._client = await aioredis.from_url(self._url)
                logger.info("Redis 缓存已连接")
            except ImportError:
                logger.error("未安装 redis 包，请运行: pip install redis")
                raise
            except Exception as e:
                logger.error(f"Redis 连接失败：{e}")
                raise
        return self._client

    async def get(self, key: str) -> Optional[Any]:
        try:
            import pickle
            client = await self._get_client()
            data = await client.get(key)
            return pickle.loads(data) if data else None
        except Exception as e:
            logger.error(f"Redis GET 失败 [{key}]：{e}")
            return None

    async def set(self, key: str, value: Any, ttl_seconds: int = 300):
        try:
            import pickle
            client = await self._get_client()
            data = pickle.dumps(value)
            if ttl_seconds > 0:
                await client.setex(key, ttl_seconds, data)
            else:
                await client.set(key, data)
        except Exception as e:
            logger.error(f"Redis SET 失败 [{key}]：{e}")

    async def delete(self, key: str) -> bool:
        try:
            client = await self._get_client()
            result = await client.delete(key)
            return result > 0
        except Exception as e:
            logger.error(f"Redis DELETE 失败 [{key}]：{e}")
            return False

    async def exists(self, key: str) -> bool:
        try:
            client = await self._get_client()
            return bool(await client.exists(key))
        except Exception as e:
            logger.error(f"Redis EXISTS 失败 [{key}]：{e}")
            return False

    async def clear(self):
        try:
            client = await self._get_client()
            await client.flushdb()
        except Exception as e:
            logger.error(f"Redis CLEAR 失败：{e}")


class CacheManager:
    """
    统一缓存管理器
    优先使用 Redis（如配置），否则回退到内存缓存
    """

    def __init__(self):
        redis_url = os.getenv("REDIS_URL")
        if redis_url:
            self._redis = RedisCache(redis_url)
            self._use_redis = True
            logger.info(f"使用 Redis 缓存：{redis_url}")
        else:
            self._memory = MemoryCache()
            self._use_redis = False
            logger.info("使用内存缓存")

    async def get(self, key: str) -> Optional[Any]:
        if self._use_redis:
            return await self._redis.get(key)
        return self._memory.get(key)

    async def set(self, key: str, value: Any, ttl_seconds: int = 300):
        if self._use_redis:
            await self._redis.set(key, value, ttl_seconds)
        else:
            self._memory.set(key, value, ttl_seconds)

    async def delete(self, key: str) -> bool:
        if self._use_redis:
            return await self._redis.delete(key)
        return self._memory.delete(key)

    async def exists(self, key: str) -> bool:
        if self._use_redis:
            return await self._redis.exists(key)
        return self._memory.exists(key)

    async def get_or_set(
        self,
        key: str,
        factory: Callable,
        ttl_seconds: int = 300,
    ) -> Any:
        """
        获取缓存值；若不存在，则调用 factory() 计算并存入缓存。
        factory 可以是普通函数或协程函数。
        """
        value = await self.get(key)
        if value is not None:
            return value

        if asyncio.iscoroutinefunction(factory):
            value = await factory()
        else:
            value = factory()

        if value is not None:
            await self.set(key, value, ttl_seconds)
        return value

    async def invalidate_prefix(self, prefix: str):
        """使以指定前缀开头的所有缓存键失效（仅内存缓存支持）"""
        if not self._use_redis:
            keys_to_delete = [k for k in self._memory._store if k.startswith(prefix)]
            for key in keys_to_delete:
                self._memory.delete(key)
            logger.debug(f"已清除 {len(keys_to_delete)} 个前缀为 '{prefix}' 的缓存键")

    def stats(self) -> dict:
        """获取缓存统计"""
        if self._use_redis:
            return {"backend": "redis", "url": self._redis._url}
        return {"backend": "memory", **self._memory.stats()}


# 全局实例
cache_manager = CacheManager()
