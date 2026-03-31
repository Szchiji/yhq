"""
缓存系统测试
"""

import asyncio
import time

import pytest
from utils.cache import MemoryCache, CacheManager


class TestMemoryCache:
    def test_set_and_get(self):
        cache = MemoryCache()
        cache.set("key1", "value1")
        assert cache.get("key1") == "value1"

    def test_get_missing_key(self):
        cache = MemoryCache()
        assert cache.get("nonexistent") is None

    def test_ttl_expiry(self):
        cache = MemoryCache()
        cache.set("temp", "value", ttl_seconds=1)
        assert cache.get("temp") == "value"
        time.sleep(1.1)
        assert cache.get("temp") is None

    def test_no_ttl(self):
        cache = MemoryCache()
        cache.set("permanent", "value", ttl_seconds=0)
        assert cache.get("permanent") == "value"

    def test_delete(self):
        cache = MemoryCache()
        cache.set("key", "val")
        assert cache.delete("key")
        assert cache.get("key") is None

    def test_exists(self):
        cache = MemoryCache()
        cache.set("exists_key", "v")
        assert cache.exists("exists_key")
        assert not cache.exists("missing_key")

    def test_clear(self):
        cache = MemoryCache()
        cache.set("a", 1)
        cache.set("b", 2)
        cache.clear()
        assert cache.size() == 0

    def test_overwrite(self):
        cache = MemoryCache()
        cache.set("key", "old")
        cache.set("key", "new")
        assert cache.get("key") == "new"

    def test_cleanup_expired(self):
        cache = MemoryCache()
        cache.set("expire_soon", "v", ttl_seconds=1)
        cache.set("keep", "v", ttl_seconds=100)
        time.sleep(1.1)
        removed = cache.cleanup_expired()
        assert removed >= 1
        assert cache.get("keep") == "v"

    def test_complex_values(self):
        cache = MemoryCache()
        data = {"name": "test", "items": [1, 2, 3]}
        cache.set("complex", data)
        assert cache.get("complex") == data


class TestCacheManager:
    @pytest.fixture
    def cache_mgr(self, monkeypatch):
        monkeypatch.delenv("REDIS_URL", raising=False)
        return CacheManager()

    @pytest.mark.asyncio
    async def test_get_set(self, cache_mgr):
        await cache_mgr.set("k", "v", ttl_seconds=60)
        result = await cache_mgr.get("k")
        assert result == "v"

    @pytest.mark.asyncio
    async def test_get_missing(self, cache_mgr):
        result = await cache_mgr.get("nonexistent_key_xyz")
        assert result is None

    @pytest.mark.asyncio
    async def test_delete(self, cache_mgr):
        await cache_mgr.set("del_key", "v")
        await cache_mgr.delete("del_key")
        assert await cache_mgr.get("del_key") is None

    @pytest.mark.asyncio
    async def test_get_or_set(self, cache_mgr):
        call_count = 0

        async def factory():
            nonlocal call_count
            call_count += 1
            return "computed_value"

        result1 = await cache_mgr.get_or_set("gos_key", factory, ttl_seconds=60)
        result2 = await cache_mgr.get_or_set("gos_key", factory, ttl_seconds=60)
        assert result1 == "computed_value"
        assert result2 == "computed_value"
        # factory 应只被调用一次
        assert call_count == 1

    @pytest.mark.asyncio
    async def test_invalidate_prefix(self, cache_mgr):
        await cache_mgr.set("prefix:key1", "v1")
        await cache_mgr.set("prefix:key2", "v2")
        await cache_mgr.set("other:key", "v3")
        await cache_mgr.invalidate_prefix("prefix:")
        assert await cache_mgr.get("prefix:key1") is None
        assert await cache_mgr.get("prefix:key2") is None
        assert await cache_mgr.get("other:key") == "v3"
