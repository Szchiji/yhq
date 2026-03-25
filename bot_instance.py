"""
机器人实例模块
"""
from aiogram import Bot, Dispatcher
from aiogram.fsm.storage.memory import MemoryStorage
from config import config

# 创建机器人实例
bot = Bot(token=config.BOT_TOKEN)

# 创建调度器（使用内存存储 FSM 状态）
storage = MemoryStorage()
dp = Dispatcher(storage=storage)
