"""
企业级备份服务
"""
import logging
from typing import List, Optional

logger = logging.getLogger(__name__)


class BackupServiceEnterprise:
    """企业级备份服务"""

    def __init__(self):
        from services.backup_service import BackupServiceWrapper
        self._base = BackupServiceWrapper()

    async def create_backup(self, label: str = "") -> Optional[str]:
        return await self._base.create_backup(label)

    async def list_backups(self) -> List[dict]:
        return await self._base.list_backups()

    async def restore_backup(self, backup_path: str) -> bool:
        return await self._base.restore_backup(backup_path)

    async def delete_old_backups(self, keep_days: int = 7) -> int:
        return await self._base.delete_old_backups(keep_days)

    async def scheduled_backup(self) -> bool:
        """执行计划备份"""
        try:
            from datetime import datetime, timezone
            label = datetime.now(timezone.utc).strftime("scheduled_%Y%m%d_%H%M%S")
            path = await self.create_backup(label)
            if path:
                logger.info(f"计划备份完成：{path}")
                removed = await self.delete_old_backups()
                logger.info(f"已删除 {removed} 个过期备份")
                return True
            return False
        except Exception as e:
            logger.error(f"计划备份失败：{e}")
            return False
