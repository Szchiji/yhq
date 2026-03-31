"""
企业级报告服务
"""
import logging
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)


class ReportServiceEnterprise:
    """企业级报告服务"""

    def __init__(self):
        from services.report_service import ReportService
        self._base = ReportService()

    async def get_pending_reports(
        self, limit: int = 20, offset: int = 0
    ) -> List[Dict]:
        return await self._base.get_pending_reports(limit, offset)

    async def get_report_by_id(self, report_id: int) -> Optional[Dict]:
        return await self._base.get_report_by_id(report_id)

    async def approve_report(
        self, report_id: int, reviewer_id: int, notify: bool = True
    ) -> bool:
        success = await self._base.approve_report(report_id, reviewer_id)
        if success and notify:
            try:
                report = await self.get_report_by_id(report_id)
                if report:
                    logger.info(
                        f"报告 {report_id} 已审核通过，提交者 {report.get('submitter_id')}"
                    )
            except Exception as e:
                logger.warning(f"发送审核通过通知失败：{e}")
        return success

    async def reject_report(
        self, report_id: int, reviewer_id: int, reason: str = ""
    ) -> bool:
        return await self._base.reject_report(report_id, reviewer_id, reason)

    async def get_stats(self) -> Dict[str, Any]:
        return await self._base.get_stats()

    async def get_ranking(self, limit: int = 10) -> List[Dict]:
        return await self._base.get_ranking(limit)

    async def bulk_approve(
        self, report_ids: List[int], reviewer_id: int
    ) -> Dict[str, int]:
        """批量审核通过"""
        success_count = 0
        fail_count = 0
        for rid in report_ids:
            if await self._base.approve_report(rid, reviewer_id):
                success_count += 1
            else:
                fail_count += 1
        return {"success": success_count, "failed": fail_count}

    async def get_reports_by_teacher(
        self, teacher_username: str, limit: int = 20
    ) -> List[Dict]:
        """获取指定教师的所有报告"""
        try:
            from database import get_db
            db = await get_db()
            cursor = await db.execute(
                "SELECT * FROM quick_evaluations WHERE teacher_username = ? "
                "ORDER BY created_at DESC LIMIT ?",
                (teacher_username, limit),
            )
            rows = await cursor.fetchall()
            return [dict(row) for row in rows]
        except Exception as e:
            logger.error(f"获取教师 {teacher_username} 报告失败：{e}")
            return []
