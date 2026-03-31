"""
管理员路由
"""
import logging

logger = logging.getLogger(__name__)

try:
    from fastapi import APIRouter, HTTPException, Depends
    from api.routes.auth import get_current_user

    router = APIRouter()

    def require_admin(current_user: int = Depends(get_current_user)):
        """检查管理员权限"""
        from core.config import core_config
        if not core_config.is_admin(current_user):
            raise HTTPException(status_code=403, detail="需要管理员权限")
        return current_user

    @router.get("/stats")
    async def get_admin_stats(admin_user: int = Depends(require_admin)):
        """获取管理统计"""
        from services.report_service import report_service
        from services.rate_limiter_service import rate_limiter_service
        stats = await report_service.get_stats()
        rate_stats = await rate_limiter_service.get_stats()
        return {
            "report_stats": stats,
            "rate_limit_stats": rate_stats,
        }

    @router.get("/blacklist")
    async def get_blacklist(admin_user: int = Depends(require_admin)):
        """获取黑名单"""
        from services.user_service import user_service
        return {"blacklist": await user_service.get_blacklist()}

    @router.post("/users/{user_id}/ban")
    async def ban_user(
        user_id: int,
        admin_user: int = Depends(require_admin),
    ):
        """封禁用户"""
        from services.user_service import user_service
        success = await user_service.ban_user(user_id)
        if not success:
            raise HTTPException(status_code=400, detail="操作失败")
        return {"message": f"用户 {user_id} 已被封禁"}

    @router.post("/users/{user_id}/unban")
    async def unban_user(
        user_id: int,
        admin_user: int = Depends(require_admin),
    ):
        """解封用户"""
        from services.user_service import user_service
        success = await user_service.unban_user(user_id)
        if not success:
            raise HTTPException(status_code=400, detail="操作失败")
        return {"message": f"用户 {user_id} 已被解封"}

    @router.post("/users/{user_id}/unlock")
    async def unlock_user(
        user_id: int,
        admin_user: int = Depends(require_admin),
    ):
        """解除限流锁定"""
        from services.rate_limiter_service import rate_limiter_service
        success = await rate_limiter_service.unlock_user(user_id)
        return {"unlocked": success}

except ImportError:
    router = None
    logger.warning("FastAPI 未安装，管理员路由不可用")
