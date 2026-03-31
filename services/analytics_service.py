"""
数据分析服务
封装 utils.analytics 的分析功能
"""
import logging
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)


class AnalyticsServiceWrapper:
    """数据分析业务服务"""

    def __init__(self):
        from utils.analytics import AnalyticsService
        self._analytics = AnalyticsService()

    async def get_report_stats(self, days: int = 7) -> Dict[str, Any]:
        return await self._analytics.get_report_stats(days)

    async def get_user_stats(self, user_id: int = None) -> Dict[str, Any]:
        # Note: current AnalyticsService.get_user_stats() does not accept user_id;
        # it returns aggregate user stats. User-specific stats require a DB query.
        return await self._analytics.get_user_stats()

    async def get_top_teachers(self, limit: int = 10) -> List[Dict]:
        return await self._analytics.get_top_teachers(limit)

    async def export_reports(
        self,
        fmt: str = "csv",
        days: int = 30,
    ) -> str:
        if fmt == "json":
            data = await self._analytics.export_stats_json()
            return data.decode("utf-8") if isinstance(data, bytes) else str(data)
        # Default to CSV
        data = await self._analytics.export_reports_csv()
        return data.decode("utf-8") if isinstance(data, bytes) else str(data)


# 全局实例
analytics_service = AnalyticsServiceWrapper()
