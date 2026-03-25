import asyncio
import logging
import os
from dotenv import load_dotenv
from aiogram import Dispatcher, Bot
from aiogram.fsm.storage.memory import MemoryStorage

# 加载环境变量
load_dotenv()

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(name)s: %(message)s'
)
logger = logging.getLogger(__name__)

# 获取配置
BOT_TOKEN = os.getenv("BOT_TOKEN")
ADMIN_IDS = list(map(int, os.getenv("ADMIN_IDS", "").split(","))) if os.getenv("ADMIN_IDS") else []

# 验证必填配置
if not BOT_TOKEN:
    logger.error("❌ BOT_TOKEN 环境变量未设置！")
    exit(1)

if not ADMIN_IDS:
    logger.warning("⚠️ ADMIN_IDS 环境变量未设置或为空")

# 初始化机器人和调度器
bot = Bot(token=BOT_TOKEN)
storage = MemoryStorage()
dp = Dispatcher(storage=storage)


async def startup():
    """启动前的准备工作"""
    try:
        # 删除任何存在的 webhook（解决 Webhook 冲突）
        await bot.delete_webhook(drop_pending_updates=False)
        logger.info("✅ Webhook 已删除，准备使用 Polling 模式")
    except Exception as e:
        logger.warning(f"⚠️ Webhook 删除提示：{e}")
    
    # 获取机器人信息
    try:
        bot_info = await bot.get_me()
        logger.info(f"✅ 机器人已启动：@{bot_info.username} ({bot_info.first_name})")
    except Exception as e:
        logger.error(f"❌ 无法获取机器人信息：{e}")
        return False
    
    # 显示管理员列表
    if ADMIN_IDS:
        logger.info(f"✅ 管理员列表：{ADMIN_IDS}")
    
    # 尝试通知管理员机器人已启动
    if ADMIN_IDS:
        for admin_id in ADMIN_IDS:
            try:
                await bot.send_message(
                    admin_id,
                    "✅ 机器人已启动！\n\n"
                    f"机器人：@{bot_info.username}\n"
                    f"ID：{bot_info.id}\n"
                    f"时间：{__import__('datetime').datetime.now().strftime('%Y-%m-%d %H:%M:%S')}"
                )
            except Exception as e:
                logger.warning(f"⚠️ 无法通知管理员 {admin_id}：{e}")
    
    return True


async def shutdown():
    """关闭时的清理工作"""
    logger.info("🛑 正在关闭机器人...")
    await bot.session.close()
    logger.info("✅ 机器人已关闭")


def register_handlers():
    """注册所有处理器"""
    try:
        # 导入所有处理器模块
        from handlers import (
            mention,      # 统计卡片查询
            report_form,  # 报告表单处理
            quick_rate,   # 快速评价
            admin,        # 管理员菜单
            template,     # 模板管理
            search,       # 标签搜索
            menu          # 主菜单
        )
        
        # 注册路由
        dp.include_router(mention.router)
        dp.include_router(report_form.router)
        dp.include_router(quick_rate.router)
        dp.include_router(admin.router)
        dp.include_router(template.router)
        dp.include_router(search.router)
        dp.include_router(menu.router)
        
        logger.info("✅ 所有处理器已注册")
        return True
    except ImportError as e:
        logger.error(f"❌ 处理器导入失败：{e}")
        return False


def init_database():
    """初始化数据库"""
    try:
        logger.info("正在初始化数据库...")
        from database import init_db
        init_db()
        logger.info("✅ 数据库初始化完成")
        return True
    except Exception as e:
        logger.error(f"❌ 数据库初始化失败：{e}")
        return False


async def main():
    """主函数"""
    try:
        # Step 1：初始化数据库
        if not init_database():
            logger.error("❌ 数据库初始化失败，退出")
            return False
        
        # Step 2：注册处理器
        if not register_handlers():
            logger.error("❌ 处理器注册失败，退出")
            return False
        
        # Step 3：启动前的准备
        if not await startup():
            logger.error("❌ 启动失败，退出")
            return False
        
        # Step 4：启动 Polling
        logger.info("🚀 开始轮询消息...")
        logger.info(f"📍 Polling 模式已激活")
        
        try:
            await dp.start_polling(
                bot,
                allowed_updates=dp.resolve_used_update_types(),
                skip_updates=False
            )
        except Exception as e:
            logger.error(f"❌ Polling 失败：{e}")
            raise
        
    except Exception as e:
        logger.error(f"❌ 致命错误：{e}", exc_info=True)
        return False
    finally:
        await shutdown()


if __name__ == "__main__":
    try:
        logger.info("=" * 50)
        logger.info("🤖 狼评机器人启动中...")
        logger.info("=" * 50)
        
        asyncio.run(main())
        
    except KeyboardInterrupt:
        logger.info("\n⚠️ 收到中止信号，正在关闭...")
    except Exception as e:
        logger.error(f"❌ 未捕获的异常：{e}", exc_info=True)
        exit(1)