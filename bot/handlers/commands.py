"""
Bot 命令处理器
处理 /start /help /report 等基础命令
"""
import logging
from aiogram import Router
from aiogram.filters import Command
from aiogram.types import Message

logger = logging.getLogger(__name__)
router = Router()


@router.message(Command("start"))
async def cmd_start(message: Message):
    """处理 /start 命令"""
    # 代理到主 handlers.menu 模块
    try:
        from handlers.menu import start_command
        await start_command(message)
    except ImportError:
        await message.answer(
            "👋 欢迎使用报告机器人！\n\n"
            "使用 /help 查看帮助信息。"
        )


@router.message(Command("help"))
async def cmd_help(message: Message):
    """处理 /help 命令"""
    await message.answer(
        "📖 <b>使用帮助</b>\n\n"
        "/start - 打开主菜单\n"
        "/help - 查看帮助\n"
        "/admin - 管理员菜单（仅限管理员）",
        parse_mode="HTML",
    )


@router.message(Command("report"))
async def cmd_report(message: Message):
    """处理 /report 命令"""
    await message.answer("📝 请使用主菜单提交报告。")
