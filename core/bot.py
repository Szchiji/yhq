"""
机器人核心模块
提供机器人实例创建和生命周期管理
"""
import asyncio
import logging
from typing import Optional

logger = logging.getLogger(__name__)


class BotCore:
    """机器人核心管理类"""

    def __init__(self):
        self._bot = None
        self._dp = None
        self._running = False

    def get_bot(self):
        """获取 Bot 实例"""
        if self._bot is None:
            self._create_bot()
        return self._bot

    def get_dispatcher(self):
        """获取 Dispatcher 实例"""
        if self._dp is None:
            self._create_bot()
        return self._dp

    def _create_bot(self):
        """创建 Bot 和 Dispatcher 实例"""
        try:
            from aiogram import Bot, Dispatcher
            from aiogram.fsm.storage.memory import MemoryStorage
            from core.config import core_config

            if not core_config.BOT_TOKEN:
                raise ValueError("BOT_TOKEN 未配置")

            self._bot = Bot(token=core_config.BOT_TOKEN)
            storage = MemoryStorage()
            self._dp = Dispatcher(storage=storage)
            logger.info("Bot 和 Dispatcher 实例已创建")
        except ImportError as e:
            logger.error(f"导入 aiogram 失败：{e}")
            raise

    async def start(self, mode: Optional[str] = None):
        """启动机器人"""
        from core.config import core_config
        run_mode = mode or core_config.BOT_MODE
        logger.info(f"正在以 {run_mode.upper()} 模式启动机器人...")
        self._running = True

    async def stop(self):
        """停止机器人"""
        if self._bot:
            await self._bot.session.close()
        self._running = False
        logger.info("机器人已停止")

    @property
    def is_running(self) -> bool:
        return self._running


# 全局实例
bot_core = BotCore()
