"""
认证路由
"""
import logging

logger = logging.getLogger(__name__)

try:
    from fastapi import APIRouter, HTTPException, Depends
    from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

    router = APIRouter()
    security = HTTPBearer(auto_error=False)

    def get_current_user(
        credentials: HTTPAuthorizationCredentials = Depends(security),
    ):
        """获取当前用户"""
        if not credentials:
            raise HTTPException(status_code=401, detail="未提供认证令牌")
        from services.auth_service import auth_service
        user_id = auth_service.verify_access_token(credentials.credentials)
        if not user_id:
            raise HTTPException(status_code=401, detail="令牌无效或已过期")
        return user_id

    @router.post("/token")
    async def create_token(user_id: int, secret: str = ""):
        """创建访问令牌（开发/测试用）"""
        import os
        if secret != os.getenv("API_KEY", ""):
            raise HTTPException(status_code=403, detail="API 密钥无效")
        from services.auth_service import auth_service
        token = auth_service.create_access_token(user_id)
        return {"access_token": token, "token_type": "bearer"}

    @router.get("/me")
    async def get_me(current_user: int = Depends(get_current_user)):
        """获取当前用户信息"""
        return {"user_id": current_user}

except ImportError:
    router = None
    logger.warning("FastAPI 未安装，认证路由不可用")
