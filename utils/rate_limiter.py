"""
限流防护模块
支持用户限流、IP 限流和防暴力破解
"""

import logging
from collections import defaultdict
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)


class RateLimiter:
    """完整的限流防护系统"""

    def __init__(self):
        # 用户操作请求记录：{user_id:action -> [timestamp, ...]}
        self.user_requests: Dict[str, List[datetime]] = defaultdict(list)

        # IP 请求记录：{ip -> [timestamp, ...]}
        self.ip_requests: Dict[str, List[datetime]] = defaultdict(list)

        # 被锁定用户：{user_id -> unlock_time}
        self.locked_users: Dict[int, datetime] = {}

        # 可疑 IP：{ip -> (count, first_seen)}
        self.suspicious_ips: Dict[str, Tuple[int, datetime]] = {}

    # ============================================================
    # 用户操作限流
    # ============================================================

    async def check_user_rate_limit(
        self,
        user_id: int,
        action: str,
        max_requests: int = 10,
        time_window_seconds: int = 60,
    ) -> Tuple[bool, Optional[str]]:
        """
        检查用户是否超过频率限制。
        返回 (is_allowed, error_message)。
        """
        # 检查是否被锁定
        if user_id in self.locked_users:
            if datetime.now() < self.locked_users[user_id]:
                remaining = int(
                    (self.locked_users[user_id] - datetime.now()).total_seconds()
                )
                return False, f"账户已锁定，请在 {remaining} 秒后重试"
            else:
                del self.locked_users[user_id]

        key = f"{user_id}:{action}"
        now = datetime.now()

        # 清理过期记录
        self.user_requests[key] = [
            t
            for t in self.user_requests[key]
            if (now - t).total_seconds() < time_window_seconds
        ]

        if len(self.user_requests[key]) >= max_requests:
            self.locked_users[user_id] = now + timedelta(minutes=5)
            return False, "操作过于频繁，账户已锁定 5 分钟"

        self.user_requests[key].append(now)
        return True, None

    async def get_user_remaining_requests(
        self,
        user_id: int,
        action: str,
        max_requests: int = 10,
        time_window_seconds: int = 60,
    ) -> int:
        """获取用户在当前时间窗口内的剩余请求次数"""
        key = f"{user_id}:{action}"
        now = datetime.now()
        self.user_requests[key] = [
            t
            for t in self.user_requests[key]
            if (now - t).total_seconds() < time_window_seconds
        ]
        return max(0, max_requests - len(self.user_requests[key]))

    # ============================================================
    # IP 限流
    # ============================================================

    async def check_ip_rate_limit(
        self,
        ip: str,
        max_requests: int = 100,
        time_window_seconds: int = 60,
    ) -> Tuple[bool, Optional[str]]:
        """检查 IP 是否超过频率限制"""
        now = datetime.now()

        self.ip_requests[ip] = [
            t
            for t in self.ip_requests[ip]
            if (now - t).total_seconds() < time_window_seconds
        ]

        if len(self.ip_requests[ip]) >= max_requests:
            count, first_seen = self.suspicious_ips.get(ip, (0, now))
            self.suspicious_ips[ip] = (count + 1, first_seen)
            return False, "请求过于频繁，请稍后再试"

        self.ip_requests[ip].append(now)
        return True, None

    # ============================================================
    # 防重复提交
    # ============================================================

    async def check_duplicate_submit(
        self,
        user_id: int,
        action: str,
        data_hash: str,
        cooldown_seconds: int = 5,
    ) -> Tuple[bool, Optional[str]]:
        """防止重复提交"""
        key = f"{user_id}:{action}:{data_hash}"
        requests = self.user_requests.get(key, [])
        if requests and (datetime.now() - requests[-1]).total_seconds() < cooldown_seconds:
            return False, f"请等待 {cooldown_seconds} 秒后再提交"
        self.user_requests[key].append(datetime.now())
        return True, None

    # ============================================================
    # 防暴力破解
    # ============================================================

    async def check_brute_force_protection(
        self,
        user_id: int,
        failed: bool,
        max_failed_attempts: int = 5,
        lockout_duration_minutes: int = 15,
    ) -> Tuple[bool, Optional[str]]:
        """防暴力破解保护"""
        key = f"login_attempt:{user_id}"
        now = datetime.now()

        if failed:
            # 清理 1 小时外的记录
            self.user_requests[key] = [
                t
                for t in self.user_requests[key]
                if (now - t).total_seconds() < 3600
            ]
            self.user_requests[key].append(now)

            if len(self.user_requests[key]) >= max_failed_attempts:
                self.locked_users[user_id] = now + timedelta(
                    minutes=lockout_duration_minutes
                )
                logger.warning(
                    f"用户 {user_id} 因连续失败 {max_failed_attempts} 次被锁定 "
                    f"{lockout_duration_minutes} 分钟"
                )
                return (
                    False,
                    f"登录失败次数过多，账户已锁定 {lockout_duration_minutes} 分钟",
                )
        else:
            # 登录成功，清除失败记录
            self.user_requests.pop(key, None)

        return True, None

    # ============================================================
    # 统计和清理
    # ============================================================

    async def get_rate_limit_stats(self) -> dict:
        """获取限流统计信息"""
        return {
            "locked_users": len(self.locked_users),
            "suspicious_ips": len(self.suspicious_ips),
            "active_rate_limits": len(self.user_requests),
            "suspicious_ips_list": [
                {"ip": ip, "count": count}
                for ip, (count, _) in list(self.suspicious_ips.items())[:10]
            ],
        }

    async def unlock_user(self, user_id: int) -> bool:
        """手动解锁用户"""
        if user_id in self.locked_users:
            del self.locked_users[user_id]
            logger.info(f"用户 {user_id} 已手动解锁")
            return True
        return False

    async def cleanup_expired_data(self):
        """清理过期数据"""
        now = datetime.now()

        # 清理已解锁用户
        self.locked_users = {
            uid: t for uid, t in self.locked_users.items() if t > now
        }

        # 清理可疑 IP（超过 24 小时）
        self.suspicious_ips = {
            ip: (count, ts)
            for ip, (count, ts) in self.suspicious_ips.items()
            if (now - ts).total_seconds() < 86400
        }


# 全局实例
rate_limiter = RateLimiter()
