import logging
from aiogram import Router, F
from aiogram.types import Message, InlineKeyboardMarkup, InlineKeyboardButton
from config import config
from database import (
    get_quick_evaluation_stats,
)

logger = logging.getLogger(__name__)

# ✅ 定义 router 对象（这是关键！）
router = Router()


def is_admin(user_id: int) -> bool:
    """检查是否是管理员"""
    return user_id in config.ADMIN_IDS


@router.message(F.text & (F.text.startswith("@") | F.text.regexp(r"#\w+")))
async def mention_handler(message: Message):
    """
    处理提及用户名的消息
    格式：@username 或 #标签
    """
    if not message.text:
        return
    
    text = message.text.strip()
    
    # ════════════════════════════════════════════════════
    # 处理标签搜索 (#标签)
    # ════════════════════════════════════════════════════
    
    if text.startswith("#"):
        # 标签搜索逻辑
        try:
            from handlers.search import tag_search_handler
            await tag_search_handler(message)
        except Exception as e:
            logger.warning(f"标签搜索处理失败：{e}")
        return
    
    # ════════════════════════════════════════════════════
    # 处理用户查询 (@username)
    # ════════════════════════════════════════════════════
    
    # 提取 @username
    if not text.startswith("@"):
        return
    
    # 移除 @ 符号
    username = text[1:].split()[0]  # 只取第一个单词
    
    if not username or len(username) < 2:
        return
    
    try:
        # 获取统计数据
        stats = await get_quick_evaluation_stats(username)
        
        # 建立统计卡片
        recommend_count = stats.get("recommend_count", 0)
        not_recommend_count = stats.get("not_recommend_count", 0)
        avg_score = stats.get("avg_score", 0)
        
        # 使用纯文本格式（不用 Markdown）
        card_text = (
            f"👤 @{username}\n"
            f"\n"
            f"📊 评价统计：\n"
            f"  👍 {recommend_count} 人\n"
            f"  👎 {not_recommend_count} 人\n"
            f"  ⭐ 平均评分：{avg_score:.2f}/10\n"
            f"\n"
            f"选择操作："
        )
        
        # 建立按钮
        kb = InlineKeyboardMarkup(inline_keyboard=[
            [
                InlineKeyboardButton(
                    text="👍 推荐",
                    callback_data=f"rate:recommend:{username}"
                ),
                InlineKeyboardButton(
                    text="👎 不推荐",
                    callback_data=f"rate:not_recommend:{username}"
                )
            ],
            [
                InlineKeyboardButton(
                    text="📝 写报告",
                    callback_data=f"report:start:{username}"
                ),
                InlineKeyboardButton(
                    text="❌ 取消",
                    callback_data="close_card"
                )
            ]
        ])
        
        # 发送卡片（纯文本，不使用 parse_mode）
        await message.reply(
            card_text,
            reply_markup=kb
        )
        
        logger.info(f"显示用户 @{username} 的统计卡片")
        
    except Exception as e:
        logger.error(f"处理用户查询失败：{e}", exc_info=True)
        await message.reply(
            f"❌ 查询失败：{str(e)}\n\n"
            f"请稍后重试或联系管理员。"
        )


@router.callback_query(lambda c: c.data == "close_card")
async def handle_close_card(callback):
    """关闭卡片"""
    try:
        await callback.message.delete()
        await callback.answer()
    except Exception as e:
        logger.error(f"关闭卡片失败：{e}")