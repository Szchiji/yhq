import asyncio
import logging
import os
from dotenv import load_dotenv
from aiogram import Dispatcher, Bot
from aiogram.fsm.storage.memory import MemoryStorage
from aiogram.types import BotCommand
from aiohttp import web

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
MODE = os.getenv("BOT_MODE", "polling")
WEBHOOK_URL = os.getenv("WEBHOOK_URL", "")
WEBHOOK_HOST = os.getenv("WEBHOOK_HOST", "0.0.0.0")
WEBHOOK_PORT = int(os.getenv("WEBHOOK_PORT", "8000"))
WEBHOOK_PATH = "/webhook"

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
        # 获取机器人信息
        bot_info = await bot.get_me()
        logger.info(f"✅ 机器人已启动：@{bot_info.username} ({bot_info.first_name})")
        
        # 显示管理员列表
        if ADMIN_IDS:
            logger.info(f"✅ 管理员列表：{ADMIN_IDS}")
        
        # 设置机器人命令菜单
        try:
            await bot.set_my_commands([
                BotCommand(command="start", description="🏠 打开主菜单"),
            ])
            logger.info("✅ 机器人命令菜单已设置")
        except Exception as e:
            logger.warning(f"⚠️ 设置命令菜单失败：{e}")
        
        # 尝试通知管理员机器人已启动
        if ADMIN_IDS:
            for admin_id in ADMIN_IDS:
                try:
                    await bot.send_message(
                        admin_id,
                        "✅ 机器人已启动！\n\n"
                        f"机器人：@{bot_info.username}\n"
                        f"ID：{bot_info.id}\n"
                        f"模式：{MODE.upper()}\n"
                        f"时间：{__import__('datetime').datetime.now().strftime('%Y-%m-%d %H:%M:%S')}"
                    )
                except Exception as e:
                    logger.warning(f"⚠️ 无法通知管理员 {admin_id}：{e}")
        
        return True
    except Exception as e:
        logger.error(f"❌ 启动失败：{e}")
        return False


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
            menu,         # 主菜单
            broadcast,    # 广播系统
            settings,     # 自定义设置
        )
        
        # 注册路由（命令处理器优先注册）
        dp.include_router(menu.router)
        dp.include_router(admin.router)
        dp.include_router(template.router)
        dp.include_router(report_form.router)
        dp.include_router(quick_rate.router)
        dp.include_router(search.router)
        dp.include_router(broadcast.router)
        dp.include_router(settings.router)
        dp.include_router(mention.router)
        
        logger.info("✅ 所有处理器已注册")
        return True
    except ImportError as e:
        logger.error(f"❌ 处理器导入失败：{e}")
        return False


async def init_database():
    """初始化数据库"""
    try:
        logger.info("正在初始化数据库...")
        from database import init_db
        # ✅ 修复：添加 await
        await init_db()
        logger.info("✅ 数据库初始化完成")
        return True
    except Exception as e:
        logger.error(f"❌ 数据库初始化失败：{e}")
        return False


# ════════════════════════════════════════════════════
# Polling 模式
# ════════════════════════════════════════════════════

async def polling_mode():
    """Polling 模式（轮询）"""
    logger.info("=" * 50)
    logger.info("📡 启动 Polling 模式（轮询）")
    logger.info("=" * 50)
    
    try:
        # 删除任何存在的 webhook
        try:
            await bot.delete_webhook(drop_pending_updates=False)
            logger.info("✅ Webhook 已删除")
        except Exception as e:
            logger.warning(f"⚠️ Webhook 删除提示：{e}")
        
        # 启动前的准备
        if not await startup():
            return False
        
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
        logger.error(f"❌ Polling 模式出错：{e}", exc_info=True)
        return False
    finally:
        await shutdown()


# ════════════════════════════════════════════════════
# Webhook 模式
# ════════════════════════════════════════════════════

async def webhook_mode():
    """Webhook 模式"""
    logger.info("=" * 50)
    logger.info("🔗 启动 Webhook 模式")
    logger.info("=" * 50)
    
    if not WEBHOOK_URL:
        logger.error("❌ Webhook 模式需要设置 WEBHOOK_URL 环境变量！")
        logger.error("例如：WEBHOOK_URL=https://yourdomain.com")
        exit(1)
    
    try:
        # 启动前的准备
        if not await startup():
            return False
        
        # 设置 Webhook
        webhook_info = await bot.set_webhook(
            url=f"{WEBHOOK_URL}{WEBHOOK_PATH}",
            drop_pending_updates=False
        )
        logger.info(f"✅ Webhook 已设置：{WEBHOOK_URL}{WEBHOOK_PATH}")
        logger.info(f"📍 Webhook 信息：{webhook_info}")
        
        # 创建 aiohttp Web 应用
        app = web.Application()
        
        # Webhook 处理器
        async def webhook_handler(request: web.Request) -> web.Response:
            """处理 Webhook 请求"""
            try:
                update_data = await request.json()
                await dp.feed_raw_update(bot, update_data)
                return web.Response(text="ok")
            except Exception as e:
                logger.error(f"❌ Webhook 处理失败：{e}", exc_info=True)
                return web.Response(text="error", status=400)
        
        # 健康检查处理器
        async def health_handler(request: web.Request) -> web.Response:
            """健康检查端点"""
            return web.Response(text="healthy")
        
        # 添加路由
        app.router.add_post(WEBHOOK_PATH, webhook_handler)
        app.router.add_get("/health", health_handler)
        
        logger.info(f"🚀 Webhook 服务器启动：{WEBHOOK_HOST}:{WEBHOOK_PORT}")
        logger.info(f"📍 Webhook 路径：{WEBHOOK_PATH}")
        logger.info(f"📍 健康检查：http://{WEBHOOK_HOST}:{WEBHOOK_PORT}/health")
        
        # 启动 Web 服务器
        runner = web.AppRunner(app)
        await runner.setup()
        site = web.TCPSite(runner, WEBHOOK_HOST, WEBHOOK_PORT)
        await site.start()
        
        logger.info("✅ Webhook 模式已启动，等待来自 Telegram 的消息...")
        
        # 保持运行
        while True:
            await asyncio.sleep(3600)
    
    except Exception as e:
        logger.error(f"❌ Webhook 模式出错：{e}", exc_info=True)
        return False
    finally:
        await shutdown()


# ════════════════════════════════════════════════════
# 混合模式
# ════════════════════════════════════════════════════

async def hybrid_mode():
    """混合模式：根据环境自动选择"""
    logger.info("=" * 50)
    logger.info("🔄 启动混合模式（自动选择）")
    logger.info("=" * 50)
    
    # 如果有 WEBHOOK_URL，使用 Webhook；否则使用 Polling
    if WEBHOOK_URL:
        logger.info("🔗 检测到 WEBHOOK_URL，使用 Webhook 模式")
        await webhook_mode()
    else:
        logger.info("📡 未检测到 WEBHOOK_URL，使用 Polling 模式")
        await polling_mode()


# ════════════════════════════════════════════════════
# 主函数
# ════════════════════════════════════════════════════

async def main():
    """主函数"""
    try:
        # Step 1：初始化数据库（✅ 修复：添加 await）
        if not await init_database():
            logger.error("❌ 数据库初始化失败，退出")
            return False
        
        # Step 2：注册处理器
        if not register_handlers():
            logger.error("❌ 处理器注册失败，退出")
            return False
        
        # Step 3：根据模式启动
        logger.info(f"📌 当前模式：{MODE.upper()}")
        
        if MODE.lower() == "webhook":
            await webhook_mode()
        elif MODE.lower() == "polling":
            await polling_mode()
        elif MODE.lower() == "hybrid":
            await hybrid_mode()
        else:
            logger.error(f"❌ 未知的模式：{MODE}")
            logger.error("✅ 可用模式：polling, webhook, hybrid")
            return False
        
    except Exception as e:
        logger.error(f"❌ 致命错误：{e}", exc_info=True)
        return False


if __name__ == "__main__":
    try:
        logger.info("=" * 50)
        logger.info("🤖 狼评机器人启动中...")
        logger.info("=" * 50)
        
        asyncio.run(main())
        
    except KeyboardInterrupt:
        logger.info("\n⚠️ 收到中止信���，正在关闭...")
    except Exception as e:
        logger.error(f"❌ 未捕获的异常：{e}", exc_info=True)
        exit(1)