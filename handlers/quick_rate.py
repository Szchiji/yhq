"""
快速评价处理模块
系统 A：快速推荐或不推荐
"""
import html
import logging

from aiogram import Router, F
from aiogram.types import Message, CallbackQuery, InlineKeyboardMarkup, InlineKeyboardButton
from aiogram.fsm.context import FSMContext

from config import config
from database import (
    save_quick_evaluation,
    get_teacher_stats,
    has_user_evaluated,
    is_blacklisted,
)
from states import QuickRateStates

logger = logging.getLogger(__name__)
router = Router()


@router.callback_query(F.data.startswith("rate:cancel:"))
async def quick_rate_cancel(callback: CallbackQuery, state: FSMContext):
    """取消快速评价"""
    try:
        await state.clear()
        await callback.message.edit_text("❌ 已取消评价")
    except Exception as e:
        logger.error(f"取消评价失败：{e}", exc_info=True)
    finally:
        await callback.answer()


@router.callback_query(F.data.startswith("rate:"))
async def quick_rate_start(callback: CallbackQuery, state: FSMContext):
    """开始快速评价流程"""
    try:
        parts = callback.data.split(":", 2)
        action = parts[1]       # recommend / not_recommend
        username = parts[2]

        user_id = callback.from_user.id

        # 检查黑名单
        if await is_blacklisted(user_id):
            await callback.answer("❌ 您已被封禁，无法评价", show_alert=True)
            return

        # 检查是否已评价
        if await has_user_evaluated(username, user_id):
            await callback.answer("⚠️ 您已经评价过该教师了", show_alert=True)
            return

        is_recommended = (action == "recommend")
        emoji = "👍" if is_recommended else "👎"
        action_text = "推荐" if is_recommended else "不推荐"

        # 保存状态
        await state.set_state(QuickRateStates.waiting_for_reason)
        await state.update_data(
            teacher_username=username,
            is_recommended=is_recommended,
        )

        kb = InlineKeyboardMarkup(inline_keyboard=[[
            InlineKeyboardButton(text="❌ 取消", callback_data=f"rate:cancel:{username}")
        ]])

        await callback.message.answer(
            f"{emoji} <b>您选择了：{action_text} @{html.escape(username)}</b>\n\n"
            f"请输入您的评价理由（至少 {config.MIN_REASON_LENGTH} 个字）：",
            reply_markup=kb,
            parse_mode="HTML",
        )
        await callback.answer()
    except Exception as e:
        await callback.answer("❌ 操作失败，请稍后重试", show_alert=True)
        logger.error(f"处理评价回调失败 (data={callback.data}, user={callback.from_user.id}): {e}", exc_info=True)


@router.message(QuickRateStates.waiting_for_reason)
async def receive_reason(message: Message, state: FSMContext):
    """接收评价理由"""
    reason = message.text or ""

    if len(reason) < config.MIN_REASON_LENGTH:
        await message.answer(
            f"⚠️ 理由太短了！请输入至少 <b>{config.MIN_REASON_LENGTH}</b> 个字的评价理由。\n"
            f"当前字数：{len(reason)} 字",
            parse_mode="HTML",
        )
        return

    data = await state.get_data()
    teacher_username = data["teacher_username"]
    is_recommended = data["is_recommended"]

    user_id = message.from_user.id
    user_name = message.from_user.full_name or str(user_id)

    # 保存评价
    await save_quick_evaluation(
        teacher_username=teacher_username,
        evaluator_id=user_id,
        evaluator_name=user_name,
        is_recommended=is_recommended,
        reason=reason,
    )

    await state.clear()

    # 获取最新统计
    stats = await get_teacher_stats(teacher_username)
    emoji = "👍" if is_recommended else "👎"
    action_text = "推荐" if is_recommended else "不推荐"

    await message.answer(
        f"✅ <b>评价已保存！</b>\n\n"
        f"{emoji} 您对 <b>@{html.escape(teacher_username)}</b> 的评价：{action_text}\n"
        f"📝 理由：{html.escape(reason)}\n\n"
        f"📊 <b>最新统计：</b>\n"
        f"• 总评价数：{stats['total']}\n"
        f"• 推荐：{stats['recommended']} | 不推荐：{stats['not_recommended']}",
        parse_mode="HTML",
    )
    logger.info(f"用户 {user_id} 对 @{teacher_username} 进行了{'推荐' if is_recommended else '不推荐'}评价")
