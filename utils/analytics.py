"""
数据分析模块
支持统计数据、报表生成和数据导出
"""

import csv
import io
import json
import logging
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)


class AnalyticsService:
    """数据分析服务"""

    def __init__(self, db_getter=None):
        """
        db_getter: 异步可调用对象，返回数据库连接。
                   若为 None，则使用项目的 database.get_db()。
        """
        self._db_getter = db_getter

    async def _get_db(self):
        if self._db_getter:
            return await self._db_getter()
        from database import get_db
        return await get_db()

    # ============================================================
    # 核心统计
    # ============================================================

    async def get_report_stats(self, days: int = 7) -> Dict[str, Any]:
        """获取报告统计数据"""
        try:
            db = await self._get_db()
            since = (
                datetime.now(timezone.utc) - timedelta(days=days)
            ).isoformat()

            cursor = await db.execute(
                "SELECT COUNT(*) AS cnt FROM reports WHERE created_at >= ?",
                (since,),
            )
            row = await cursor.fetchone()
            total_period = row["cnt"] if row else 0

            cursor = await db.execute("SELECT COUNT(*) AS cnt FROM reports")
            row = await cursor.fetchone()
            total_all = row["cnt"] if row else 0

            cursor = await db.execute(
                "SELECT COUNT(*) AS cnt FROM reports WHERE status = 'approved'"
            )
            row = await cursor.fetchone()
            approved = row["cnt"] if row else 0

            cursor = await db.execute(
                "SELECT COUNT(*) AS cnt FROM reports WHERE status = 'pending'"
            )
            row = await cursor.fetchone()
            pending = row["cnt"] if row else 0

            return {
                "total_reports": total_all,
                "reports_last_n_days": total_period,
                "approved_reports": approved,
                "pending_reports": pending,
                "approval_rate": round(approved / total_all * 100, 1) if total_all > 0 else 0,
                "period_days": days,
                "generated_at": datetime.now(timezone.utc).isoformat(),
            }
        except Exception as e:
            logger.error(f"获取报告统计失败：{e}")
            return {"error": "internal_error"}

    async def get_user_stats(self) -> Dict[str, Any]:
        """获取用户统计数据"""
        try:
            db = await self._get_db()
            cursor = await db.execute("SELECT COUNT(*) AS cnt FROM users")
            row = await cursor.fetchone()
            total_users = row["cnt"] if row else 0

            cursor = await db.execute("SELECT COUNT(*) AS cnt FROM blacklist")
            row = await cursor.fetchone()
            blacklisted = row["cnt"] if row else 0

            return {
                "total_users": total_users,
                "blacklisted_users": blacklisted,
                "active_users": total_users - blacklisted,
                "generated_at": datetime.now(timezone.utc).isoformat(),
            }
        except Exception as e:
            logger.error(f"获取用户统计失败：{e}")
            return {"error": "internal_error"}

    async def get_top_teachers(self, limit: int = 10) -> List[Dict[str, Any]]:
        """获取评价最多的教师排行"""
        try:
            db = await self._get_db()
            cursor = await db.execute(
                """
                SELECT teacher_name, COUNT(*) AS report_count,
                       AVG(CASE WHEN status='approved' THEN 1.0 ELSE 0.0 END) AS approval_rate
                FROM reports
                GROUP BY teacher_name
                ORDER BY report_count DESC
                LIMIT ?
                """,
                (limit,),
            )
            rows = await cursor.fetchall()
            return [
                {
                    "teacher_name": row["teacher_name"],
                    "report_count": row["report_count"],
                    "approval_rate": round(row["approval_rate"] * 100, 1),
                }
                for row in rows
            ]
        except Exception as e:
            logger.error(f"获取教师排行失败：{e}")
            return []

    async def get_daily_report_counts(self, days: int = 30) -> List[Dict[str, Any]]:
        """获取每日报告数量趋势"""
        try:
            db = await self._get_db()
            since = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
            cursor = await db.execute(
                """
                SELECT DATE(created_at) AS date, COUNT(*) AS count
                FROM reports
                WHERE created_at >= ?
                GROUP BY DATE(created_at)
                ORDER BY date ASC
                """,
                (since,),
            )
            rows = await cursor.fetchall()
            return [{"date": row["date"], "count": row["count"]} for row in rows]
        except Exception as e:
            logger.error(f"获取每日报告数量失败：{e}")
            return []

    # ============================================================
    # 数据导出
    # ============================================================

    async def export_reports_csv(
        self,
        status: Optional[str] = None,
        days: Optional[int] = None,
    ) -> bytes:
        """将报告导出为 CSV 格式"""
        try:
            db = await self._get_db()
            query = "SELECT id, user_id, teacher_name, status, created_at FROM reports WHERE 1=1"
            params = []
            if status:
                query += " AND status = ?"
                params.append(status)
            if days:
                since = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
                query += " AND created_at >= ?"
                params.append(since)
            query += " ORDER BY created_at DESC"

            cursor = await db.execute(query, params)
            rows = await cursor.fetchall()

            output = io.StringIO()
            writer = csv.writer(output)
            writer.writerow(["ID", "用户ID", "教师姓名", "状态", "创建时间"])
            for row in rows:
                writer.writerow([
                    row["id"],
                    row["user_id"],
                    row["teacher_name"],
                    row["status"],
                    row["created_at"],
                ])
            return output.getvalue().encode("utf-8-sig")
        except Exception as e:
            logger.error(f"导出 CSV 失败：{e}")
            return b""

    async def export_stats_json(self) -> bytes:
        """将统计数据导出为 JSON 格式"""
        try:
            stats = {
                "reports": await self.get_report_stats(days=30),
                "users": await self.get_user_stats(),
                "top_teachers": await self.get_top_teachers(limit=10),
                "export_time": datetime.now(timezone.utc).isoformat(),
            }
            return json.dumps(stats, ensure_ascii=False, indent=2).encode()
        except Exception as e:
            logger.error(f"导出 JSON 失败：{e}")
            return b"{}"

    async def get_summary_text(self) -> str:
        """生成文字摘要报告"""
        stats = await self.get_report_stats(days=7)
        user_stats = await self.get_user_stats()

        return (
            f"📊 <b>数据摘要</b>\n\n"
            f"📝 总报告数：{stats.get('total_reports', 0)}\n"
            f"⏳ 待审核：{stats.get('pending_reports', 0)}\n"
            f"✅ 已通过：{stats.get('approved_reports', 0)}\n"
            f"📈 通过率：{stats.get('approval_rate', 0)}%\n"
            f"🕐 近 7 天新增：{stats.get('reports_last_n_days', 0)}\n\n"
            f"👥 用户数：{user_stats.get('total_users', 0)}\n"
            f"🚫 黑名单：{user_stats.get('blacklisted_users', 0)}\n"
        )


# 全局实例
analytics_service = AnalyticsService()
