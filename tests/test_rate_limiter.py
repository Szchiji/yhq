"""
限流系统测试
"""

import asyncio

import pytest
from utils.rate_limiter import RateLimiter


class TestRateLimiter:
    @pytest.fixture
    def limiter(self):
        return RateLimiter()

    @pytest.mark.asyncio
    async def test_user_rate_limit_allows_under_limit(self, limiter):
        for _ in range(5):
            allowed, err = await limiter.check_user_rate_limit(
                user_id=1, action="test", max_requests=10, time_window_seconds=60
            )
            assert allowed
            assert err is None

    @pytest.mark.asyncio
    async def test_user_rate_limit_blocks_over_limit(self, limiter):
        # 消耗所有配额
        for _ in range(3):
            await limiter.check_user_rate_limit(
                user_id=2, action="submit", max_requests=3, time_window_seconds=60
            )
        # 第 4 次应被拦截
        allowed, err = await limiter.check_user_rate_limit(
            user_id=2, action="submit", max_requests=3, time_window_seconds=60
        )
        assert not allowed
        assert err is not None

    @pytest.mark.asyncio
    async def test_locked_user_is_blocked(self, limiter):
        # 触发锁定
        for _ in range(3):
            await limiter.check_user_rate_limit(
                user_id=3, action="x", max_requests=3, time_window_seconds=60
            )
        # 触发一次超限，导致锁定
        await limiter.check_user_rate_limit(
            user_id=3, action="x", max_requests=3, time_window_seconds=60
        )
        # 随后请求应因锁定被拒绝
        allowed, err = await limiter.check_user_rate_limit(
            user_id=3, action="other", max_requests=100, time_window_seconds=60
        )
        assert not allowed
        assert "锁定" in (err or "")

    @pytest.mark.asyncio
    async def test_unlock_user(self, limiter):
        # 锁定用户
        for _ in range(4):
            await limiter.check_user_rate_limit(
                user_id=4, action="a", max_requests=3, time_window_seconds=60
            )
        # 手动解锁
        unlocked = await limiter.unlock_user(4)
        assert unlocked
        # 解锁后应可正常请求
        allowed, _ = await limiter.check_user_rate_limit(
            user_id=4, action="a", max_requests=100, time_window_seconds=60
        )
        assert allowed

    @pytest.mark.asyncio
    async def test_ip_rate_limit(self, limiter):
        ip = "192.168.1.100"
        # 3 次请求在限制内
        for _ in range(3):
            allowed, _ = await limiter.check_ip_rate_limit(
                ip=ip, max_requests=3, time_window_seconds=60
            )
            assert allowed
        # 第 4 次应被拦截
        allowed, err = await limiter.check_ip_rate_limit(
            ip=ip, max_requests=3, time_window_seconds=60
        )
        assert not allowed
        assert err is not None

    @pytest.mark.asyncio
    async def test_different_users_independent(self, limiter):
        """不同用户的限流应相互独立"""
        # 用户 10 用尽配额
        for _ in range(3):
            await limiter.check_user_rate_limit(
                user_id=10, action="act", max_requests=3, time_window_seconds=60
            )
        # 用户 11 不受影响
        allowed, _ = await limiter.check_user_rate_limit(
            user_id=11, action="act", max_requests=3, time_window_seconds=60
        )
        assert allowed

    @pytest.mark.asyncio
    async def test_remaining_requests(self, limiter):
        user_id = 20
        action = "count_test"
        max_req = 5
        remaining = await limiter.get_user_remaining_requests(
            user_id, action, max_requests=max_req
        )
        assert remaining == max_req

        await limiter.check_user_rate_limit(
            user_id=user_id, action=action, max_requests=max_req
        )
        remaining = await limiter.get_user_remaining_requests(
            user_id, action, max_requests=max_req
        )
        assert remaining == max_req - 1

    @pytest.mark.asyncio
    async def test_brute_force_protection(self, limiter):
        user_id = 30
        # 连续失败 5 次
        for _ in range(5):
            await limiter.check_brute_force_protection(
                user_id=user_id, failed=True, max_failed_attempts=5
            )
        # 第 5 次触发锁定
        allowed, err = await limiter.check_brute_force_protection(
            user_id=user_id, failed=True, max_failed_attempts=5
        )
        assert not allowed

    @pytest.mark.asyncio
    async def test_get_stats(self, limiter):
        stats = await limiter.get_rate_limit_stats()
        assert "locked_users" in stats
        assert "suspicious_ips" in stats
        assert "active_rate_limits" in stats
