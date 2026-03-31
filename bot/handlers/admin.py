"""
Bot 管理员处理器
代理到主 handlers.admin 模块
"""
import logging
from aiogram import Router

logger = logging.getLogger(__name__)
router = Router()

# 从主模块导入路由器（向后兼容）
try:
    from handlers.admin import router as _admin_router
    router = _admin_router
except ImportError:
    pass
