"""
报告路由
"""
import logging
from typing import List, Optional

logger = logging.getLogger(__name__)

try:
    from fastapi import APIRouter, HTTPException, Depends, Query
    from api.routes.auth import get_current_user

    router = APIRouter()

    @router.get("/")
    async def list_reports(
        page: int = Query(1, ge=1),
        per_page: int = Query(10, ge=1, le=100),
        status: Optional[str] = None,
        current_user: int = Depends(get_current_user),
    ):
        """获取报告列表"""
        from services.report_service import report_service
        offset = (page - 1) * per_page
        reports = await report_service.get_pending_reports(
            limit=per_page, offset=offset
        )
        return {"reports": reports, "page": page, "per_page": per_page}

    @router.get("/ranking")
    async def get_ranking(
        limit: int = Query(10, ge=1, le=100),
    ):
        """获取排行榜"""
        from services.report_service import report_service
        ranking = await report_service.get_ranking(limit=limit)
        return {"ranking": ranking}

    @router.get("/stats")
    async def get_stats(current_user: int = Depends(get_current_user)):
        """获取统计数据"""
        from services.report_service import report_service
        stats = await report_service.get_stats()
        return stats

    @router.get("/{report_id}")
    async def get_report(
        report_id: int,
        current_user: int = Depends(get_current_user),
    ):
        """获取单个报告"""
        from services.report_service import report_service
        report = await report_service.get_report_by_id(report_id)
        if not report:
            raise HTTPException(status_code=404, detail="报告不存在")
        return report

    @router.post("/{report_id}/approve")
    async def approve_report(
        report_id: int,
        current_user: int = Depends(get_current_user),
    ):
        """审核通过报告"""
        from services.report_service import report_service
        success = await report_service.approve_report(report_id, current_user)
        if not success:
            raise HTTPException(status_code=400, detail="审核操作失败")
        return {"message": "报告已通过审核"}

    @router.post("/{report_id}/reject")
    async def reject_report(
        report_id: int,
        reason: str = "",
        current_user: int = Depends(get_current_user),
    ):
        """拒绝报告"""
        from services.report_service import report_service
        success = await report_service.reject_report(report_id, current_user, reason)
        if not success:
            raise HTTPException(status_code=400, detail="操作失败")
        return {"message": "报告已被拒绝"}

except ImportError:
    router = None
    logger.warning("FastAPI 未安装，报告路由不可用")
