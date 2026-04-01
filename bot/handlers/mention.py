"""
Bot @mention 处理器
代理到主 handlers.mention 模块
"""
import logging
from aiogram import Router

logger = logging.getLogger(__name__)
router = Router()

try:
    from handlers.mention import router as _mention_router
    router = _mention_router
except ImportError:
    pass
