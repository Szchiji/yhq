"""
报告业务服务
"""
import logging
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)


class ReportService:
    """报告业务逻辑服务"""

    async def get_pending_reports(self, limit: int = 20, offset: int = 0) -> List[Dict]:
        """获取待审核报告列表"""
        try:
            from database import get_pending_reports
            reports = await get_pending_reports()
            return reports[offset:offset + limit]
        except Exception as e:
            logger.error(f"获取待审核报告失败：{e}")
            return []

    async def get_report_by_id(self, report_id: int) -> Optional[Dict]:
        """根据 ID 获取报告"""
        try:
            from database import get_pending_report_by_id
            return await get_pending_report_by_id(report_id)
        except Exception as e:
            logger.error(f"获取报告 {report_id} 失败：{e}")
            return None

    async def approve_report(self, report_id: int, reviewer_id: int) -> bool:
        """审核通过报告"""
        try:
            from database import approve_report
            await approve_report(report_id, reviewer_id)
            return True
        except Exception as e:
            logger.error(f"审核报告 {report_id} 失败：{e}")
            return False

    async def reject_report(self, report_id: int, reviewer_id: int, reason: str = "") -> bool:
        """拒绝报告"""
        try:
            from database import reject_report
            await reject_report(report_id, reviewer_id, reason)
            return True
        except Exception as e:
            logger.error(f"拒绝报告 {report_id} 失败：{e}")
            return False

    async def get_stats(self) -> Dict[str, Any]:
        """获取统计数据"""
        try:
            from database import get_total_stats
            return await get_total_stats()
        except Exception as e:
            logger.error(f"获取统计数据失败：{e}")
            return {}

    async def get_ranking(self, limit: int = 10) -> List[Dict]:
        """获取排行榜"""
        try:
            from database import get_ranking
            return await get_ranking(limit=limit)
        except Exception as e:
            logger.error(f"获取排行榜失败：{e}")
            return []


# 全局实例
report_service = ReportService()
