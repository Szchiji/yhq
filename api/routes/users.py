"""
用户路由
"""
import logging

logger = logging.getLogger(__name__)

try:
    from fastapi import APIRouter, HTTPException, Depends
    from api.routes.auth import get_current_user

    router = APIRouter()

    @router.get("/me")
    async def get_my_profile(current_user: int = Depends(get_current_user)):
        """获取我的个人信息"""
        from services.user_service import user_service
        user = await user_service.get_user(current_user)
        if not user:
            return {"user_id": current_user, "message": "用户信息暂未记录"}
        return user

    @router.get("/{user_id}")
    async def get_user(
        user_id: int,
        current_user: int = Depends(get_current_user),
    ):
        """获取用户信息"""
        from services.user_service import user_service
        user = await user_service.get_user(user_id)
        if not user:
            raise HTTPException(status_code=404, detail="用户不存在")
        return user

except ImportError:
    router = None
    logger.warning("FastAPI 未安装，用户路由不可用")
