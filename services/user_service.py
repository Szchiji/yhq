"""
用户业务服务
"""
import logging
from typing import Dict, List, Optional

logger = logging.getLogger(__name__)


class UserService:
    """用户业务逻辑服务"""

    async def get_user(self, user_id: int) -> Optional[Dict]:
        """获取用户信息"""
        try:
            from database import get_db
            db = await get_db()
            cursor = await db.execute(
                "SELECT * FROM users WHERE id = ?", (user_id,)
            )
            row = await cursor.fetchone()
            return dict(row) if row else None
        except Exception as e:
            logger.error(f"获取用户 {user_id} 失败：{e}")
            return None

    async def upsert_user(
        self,
        user_id: int,
        username: Optional[str] = None,
        first_name: str = "",
        last_name: str = "",
    ) -> bool:
        """创建或更新用户"""
        try:
            from database import upsert_user
            await upsert_user(user_id, username, first_name, last_name)
            return True
        except Exception as e:
            logger.error(f"更新用户 {user_id} 失败：{e}")
            return False

    async def ban_user(self, user_id: int) -> bool:
        """封禁用户"""
        try:
            from database import add_to_blacklist
            await add_to_blacklist(user_id)
            return True
        except Exception as e:
            logger.error(f"封禁用户 {user_id} 失败：{e}")
            return False

    async def unban_user(self, user_id: int) -> bool:
        """解封用户"""
        try:
            from database import remove_from_blacklist
            await remove_from_blacklist(user_id)
            return True
        except Exception as e:
            logger.error(f"解封用户 {user_id} 失败：{e}")
            return False

    async def is_banned(self, user_id: int) -> bool:
        """检查用户是否被封禁"""
        try:
            from database import is_blacklisted
            return await is_blacklisted(user_id)
        except Exception as e:
            logger.error(f"检查用户 {user_id} 封禁状态失败：{e}")
            return False

    async def get_blacklist(self) -> List[Dict]:
        """获取黑名单列表"""
        try:
            from database import get_blacklist
            return await get_blacklist()
        except Exception as e:
            logger.error(f"获取黑名单失败：{e}")
            return []


# 全局实例
user_service = UserService()
