"""
备份服务
封装 utils.backup_service 的备份功能
"""
import logging
import os
from typing import List, Optional

logger = logging.getLogger(__name__)


class BackupServiceWrapper:
    """备份业务服务"""

    def __init__(self):
        from utils.backup_service import BackupService
        source_dir = os.getenv("DATA_DIR", "data")
        backup_dir = os.getenv("BACKUP_DIR", "backups")
        encryption_key = os.getenv("BACKUP_ENCRYPTION_KEY")
        # Ensure directories exist
        os.makedirs(backup_dir, exist_ok=True)
        self._backup = BackupService(
            source_dir=source_dir,
            backup_dir=backup_dir,
            encryption_key=encryption_key,
        )

    async def create_backup(self, label: str = "") -> Optional[str]:
        try:
            self._backup.perform_backup()
            return self._backup.backup_dir
        except Exception as e:
            logger.error(f"创建备份失败：{e}")
            return None

    async def list_backups(self) -> List[dict]:
        try:
            import os
            backup_dir = self._backup.backup_dir
            if not os.path.isdir(backup_dir):
                return []
            files = []
            for f in os.listdir(backup_dir):
                full_path = os.path.join(backup_dir, f)
                if os.path.isfile(full_path):
                    stat = os.stat(full_path)
                    files.append({
                        "name": f,
                        "path": full_path,
                        "size": stat.st_size,
                    })
            return files
        except Exception as e:
            logger.error(f"列出备份失败：{e}")
            return []

    async def restore_backup(self, backup_path: str) -> bool:
        try:
            self._backup.restore_backup(backup_path)
            return True
        except Exception as e:
            logger.error(f"恢复备份失败：{e}")
            return False

    async def delete_old_backups(self, keep_days: int = 7) -> int:
        try:
            import os
            import time
            backup_dir = self._backup.backup_dir
            if not os.path.isdir(backup_dir):
                return 0
            cutoff = time.time() - keep_days * 86400
            removed = 0
            for f in os.listdir(backup_dir):
                full_path = os.path.join(backup_dir, f)
                if os.path.isfile(full_path) and os.path.getmtime(full_path) < cutoff:
                    os.remove(full_path)
                    removed += 1
            return removed
        except Exception as e:
            logger.error(f"删除旧备份失败：{e}")
            return 0


# 全局实例
backup_service = BackupServiceWrapper()
