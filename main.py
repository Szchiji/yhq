"""
教师评价平台机器人主入口
"""
import asyncio
import logging
import sys

from aiogram import Bot, Dispatcher
from aiogram.fsm.storage.memory import MemoryStorage

from config import config
from database import init_db, close_db
from handlers import menu, mention, quick_rate, report_form, search, admin, template

# ============================================================
# 日志配置
# ============================================================

logging.basicConfig(
    level=getattr(logging, config.LOG_LEVEL, logging.INFO),
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[
        logging.StreamHandler(sys.stdout),
    ],
)
logger = logging.getLogger(__name__)


async def on_startup(bot: Bot):
    """机器人启动时的初始化操作"""
    logger.info("正在初始化数据库...")
    await init_db()

    bot_info = await bot.get_me()
    logger.info(f"机器人已启动：@{bot_info.username} ({bot_info.full_name})")
    logger.info(f"管理员列表：{config.ADMIN_IDS}")

    # 通知管理员机器人已启动
    for admin_id in config.ADMIN_IDS:
        try:
            await bot.send_message(
                admin_id,
                f"✅ 机器人 @{bot_info.username} 已启动！\n"
                f"数据库类型：{config.DATABASE_TYPE}\n"
                f"环境：{config.ENVIRONMENT}",
            )
        except Exception as e:
            logger.warning(f"无法通知管理员 {admin_id}: {e}")


async def on_shutdown(bot: Bot):
    """机器人关闭时的清理操作"""
    logger.info("正在关闭机器人...")
    await close_db()
    logger.info("数据库已关闭")


async def main():
    """主函数"""
    # 验证配置
    try:
        config.validate()
    except ValueError as e:
        logger.error(f"配置错误：{e}")
        logger.error("请检查 .env 文件或环境变量配置")
        sys.exit(1)

    # 创建机器人实例
    bot = Bot(token=config.BOT_TOKEN)
    storage = MemoryStorage()
    dp = Dispatcher(storage=storage)

    # 注册路由
    dp.include_router(menu.router)
    dp.include_router(mention.router)
    dp.include_router(quick_rate.router)
    dp.include_router(report_form.router)
    dp.include_router(search.router)
    dp.include_router(admin.router)
    dp.include_router(template.router)

    # 注册生命周期钩子
    dp.startup.register(on_startup)
    dp.shutdown.register(on_shutdown)

    logger.info("开始轮询...")

    try:
        await dp.start_polling(bot, allowed_updates=dp.resolve_used_update_types())
    finally:
        await bot.session.close()


if __name__ == "__main__":
    asyncio.run(main())
