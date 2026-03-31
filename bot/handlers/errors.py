"""
Bot 错误处理器
"""
import logging
from aiogram import Router
from aiogram.types import ErrorEvent

logger = logging.getLogger(__name__)
router = Router()


@router.errors()
async def errors_handler(event: ErrorEvent):
    """全局错误处理器"""
    logger.error(f"更新处理异常：{event.exception}", exc_info=event.exception)
