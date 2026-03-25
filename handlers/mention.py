import logging
from aiogram import Router
from aiogram.types import Message, InlineKeyboardMarkup, InlineKeyboardButton
from config import config
from database import (
    get_quick_evaluation_stats,
    get_user_rating,
    save_quick_evaluation
)

logger = logging.getLogger(__name__)

# ✅ 定义 router 对象（这是关键！）
router = Router()


def is_admin(user_id: int) -> bool:
    """检查是否是管理员"""
    return user_id in config.ADMIN_IDS


@router.message()
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
            from handlers.search import handle_tag_search
            await handle_tag_search(message)
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
        stats = get_quick_evaluation_stats(username)
        
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
                    callback_data=f"quick_recommend|{username}"
                ),
                InlineKeyboardButton(
                    text="👎 不推荐",
                    callback_data=f"quick_not_recommend|{username}"
                )
            ],
            [
                InlineKeyboardButton(
                    text="📝 写报告",
                    callback_data=f"report_start|{username}"
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


@router.callback_query(lambda c: c.data.startswith("quick_recommend|"))
async def handle_quick_recommend(callback, state):
    """快速推荐"""
    try:
        username = callback.data.split("|")[1]
        
        await callback.message.edit_text(
            f"请输入对 @{username} 的推荐理由\n\n"
            f"（至少 12 个字符）"
        )
        
        # 保存用户名到状态
        await state.update_data(
            quick_eval_username=username,
            quick_eval_recommend=True
        )
        
        await callback.answer()
        
    except Exception as e:
        logger.error(f"快速推荐处理失败：{e}")
        await callback.answer("❌ 处理失败", show_alert=True)


@router.callback_query(lambda c: c.data.startswith("quick_not_recommend|"))
async def handle_quick_not_recommend(callback, state):
    """快速不推荐"""
    try:
        username = callback.data.split("|")[1]
        
        await callback.message.edit_text(
            f"请输入对 @{username} 的不推荐理由\n\n"
            f"（至少 12 个字符）"
        )
        
        # 保存用户名到状态
        await state.update_data(
            quick_eval_username=username,
            quick_eval_recommend=False
        )
        
        await callback.answer()
        
    except Exception as e:
        logger.error(f"快速不推荐处理失败：{e}")
        await callback.answer("❌ 处理失败", show_alert=True)


@router.callback_query(lambda c: c.data == "close_card")
async def handle_close_card(callback):
    """关闭卡片"""
    try:
        await callback.message.delete()
        await callback.answer()
    except Exception as e:
        logger.error(f"关闭卡片失败：{e}")


@router.callback_query(lambda c: c.data.startswith("report_start|"))
async def handle_report_start(callback, state):
    """开始写报告"""
    try:
        username = callback.data.split("|")[1]
        
        await callback.answer()
        await callback.message.delete()
        
        # 开始报告流程
        await callback.message.answer(
            f"📝 开始为 @{username} 写报告\n\n"
            f"第一步：您对 @{username} 的态度是？"
        )
        
        # 保存用户名到状态
        await state.update_data(report_target_username=username)
        
    except Exception as e:
        logger.error(f"开始写报告失败：{e}")
        await callback.answer("❌ 处理失败", show_alert=True)