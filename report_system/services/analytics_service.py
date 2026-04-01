"""
企业级数据分析服务
"""
import logging
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)


class AnalyticsServiceEnterprise:
    """企业级数据分析服务"""

    def __init__(self):
        from services.analytics_service import AnalyticsServiceWrapper
        self._base = AnalyticsServiceWrapper()

    async def get_report_stats(self, days: int = 7) -> Dict[str, Any]:
        return await self._base.get_report_stats(days)

    async def get_user_stats(self, user_id: int) -> Dict[str, Any]:
        return await self._base.get_user_stats(user_id)

    async def get_top_teachers(self, limit: int = 10) -> List[Dict]:
        return await self._base.get_top_teachers(limit)

    async def export_reports(self, fmt: str = "csv", days: int = 30) -> str:
        return await self._base.export_reports(fmt, days)

    async def get_dashboard_data(self) -> Dict[str, Any]:
        """获取仪表盘综合数据"""
        try:
            stats_7d = await self.get_report_stats(7)
            stats_30d = await self.get_report_stats(30)
            top_teachers = await self.get_top_teachers(5)
            return {
                "stats_7d": stats_7d,
                "stats_30d": stats_30d,
                "top_teachers": top_teachers,
            }
        except Exception as e:
            logger.error(f"获取仪表盘数据失败：{e}")
            return {}

    async def get_trend_data(self, days: int = 30) -> List[Dict]:
        """获取趋势数据"""
        try:
            from database import get_db
            from datetime import datetime, timezone, timedelta
            db = await get_db()
            result = []
            for i in range(days):
                date = (
                    datetime.now(timezone.utc) - timedelta(days=days - 1 - i)
                ).strftime("%Y-%m-%d")
                cursor = await db.execute(
                    "SELECT COUNT(*) AS cnt FROM quick_evaluations "
                    "WHERE DATE(created_at) = ?",
                    (date,),
                )
                row = await cursor.fetchone()
                result.append({"date": date, "count": row["cnt"] if row else 0})
            return result
        except Exception as e:
            logger.error(f"获取趋势数据失败：{e}")
            return []
