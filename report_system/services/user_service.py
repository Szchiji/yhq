"""
企业级用户服务
"""
import logging
from typing import Dict, List, Optional

logger = logging.getLogger(__name__)


class UserServiceEnterprise:
    """企业级用户服务"""

    def __init__(self):
        from services.user_service import UserService
        self._base = UserService()

    async def get_user(self, user_id: int) -> Optional[Dict]:
        return await self._base.get_user(user_id)

    async def upsert_user(self, user_id: int, **kwargs) -> bool:
        return await self._base.upsert_user(user_id, **kwargs)

    async def ban_user(self, user_id: int) -> bool:
        return await self._base.ban_user(user_id)

    async def unban_user(self, user_id: int) -> bool:
        return await self._base.unban_user(user_id)

    async def is_banned(self, user_id: int) -> bool:
        return await self._base.is_banned(user_id)

    async def get_blacklist(self) -> List[Dict]:
        return await self._base.get_blacklist()

    async def get_user_activity(self, user_id: int) -> Dict:
        """获取用户活跃度统计"""
        try:
            from database import get_db
            db = await get_db()
            cursor = await db.execute(
                "SELECT COUNT(*) AS report_count FROM quick_evaluations "
                "WHERE evaluator_id = ?",
                (user_id,),
            )
            row = await cursor.fetchone()
            count = row["report_count"] if row else 0
            return {"user_id": user_id, "report_count": count}
        except Exception as e:
            logger.error(f"获取用户 {user_id} 活跃度失败：{e}")
            return {"user_id": user_id, "report_count": 0}
