"""
广播系统处理模块
管理员可以向所有与机器人交互过的用户发送广播消息
"""
import html
import logging

from aiogram import Router, F, Bot
from aiogram.filters import Command
from aiogram.fsm.context import FSMContext
from aiogram.types import (
    Message,
    CallbackQuery,
    InlineKeyboardMarkup,
    InlineKeyboardButton,
)

from config import config
from database import (
    get_all_users,
    get_user_count,
    save_broadcast,
    get_broadcasts,
)
from states import BroadcastStates

logger = logging.getLogger(__name__)
router = Router()


# ============================================================
# 广播入口
# ============================================================

@router.message(Command("broadcast"))
async def broadcast_command(message: Message, state: FSMContext):
    """管理员广播命令入口"""
    if not config.is_admin(message.from_user.id):
        await message.answer("❌ 您没有管理员权限")
        return

    user_count = await get_user_count()

    kb = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="❌ 取消", callback_data="broadcast:cancel")],
    ])
    await state.set_state(BroadcastStates.composing)
    await message.answer(
        f"📢 <b>广播系统</b>\n\n"
        f"当前用户总数：<b>{user_count}</b> 人\n\n"
        f"请发送您要广播的内容（支持文字、图片、视频）：",
        reply_markup=kb,
        parse_mode="HTML",
    )


@router.callback_query(F.data == "admin:broadcast")
async def broadcast_menu_callback(callback: CallbackQuery, state: FSMContext):
    """从管理菜单进入广播"""
    if not config.is_admin(callback.from_user.id):
        await callback.answer("❌ 无权限", show_alert=True)
        return

    user_count = await get_user_count()

    kb = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="📋 广播历史", callback_data="broadcast:history")],
        [InlineKeyboardButton(text="📢 发送新广播", callback_data="broadcast:compose")],
        [InlineKeyboardButton(text="🔙 返回", callback_data="admin_menu")],
    ])
    await callback.message.edit_text(
        f"📢 <b>广播系统</b>\n\n"
        f"当前用户总数：<b>{user_count}</b> 人\n\n"
        f"选择操作：",
        reply_markup=kb,
        parse_mode="HTML",
    )
    await callback.answer()


@router.callback_query(F.data == "broadcast:compose")
async def start_compose(callback: CallbackQuery, state: FSMContext):
    """开始编写广播内容"""
    if not config.is_admin(callback.from_user.id):
        await callback.answer("❌ 无权限", show_alert=True)
        return

    kb = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="❌ 取消", callback_data="broadcast:cancel")],
    ])
    await state.set_state(BroadcastStates.composing)
    await callback.message.answer(
        "📢 请发送您要广播的内容（支持文字、图片、视频）：",
        reply_markup=kb,
    )
    await callback.answer()


# ============================================================
# 接收广播内容
# ============================================================

@router.message(BroadcastStates.composing, F.text)
async def receive_broadcast_text(message: Message, state: FSMContext):
    """接收文字广播内容"""
    await state.update_data(
        content_type="text",
        text=message.text,
        file_id="",
    )
    await _show_broadcast_preview(message, state, message.text, "text")


@router.message(BroadcastStates.composing, F.photo)
async def receive_broadcast_photo(message: Message, state: FSMContext):
    """接收图片广播内容"""
    photo = message.photo[-1]  # 取最大分辨率
    caption = message.caption or ""
    await state.update_data(
        content_type="photo",
        text=caption,
        file_id=photo.file_id,
    )
    preview = f"[图片]{(' — ' + caption) if caption else ''}"
    await _show_broadcast_preview(message, state, preview, "photo")


@router.message(BroadcastStates.composing, F.video)
async def receive_broadcast_video(message: Message, state: FSMContext):
    """接收视频广播内容"""
    video = message.video
    caption = message.caption or ""
    await state.update_data(
        content_type="video",
        text=caption,
        file_id=video.file_id,
    )
    preview = f"[视频]{(' — ' + caption) if caption else ''}"
    await _show_broadcast_preview(message, state, preview, "video")


async def _show_broadcast_preview(message: Message, state: FSMContext, preview: str, content_type: str):
    """显示广播预览并请求确认"""
    user_count = await get_user_count()
    await state.set_state(BroadcastStates.confirming)

    kb = InlineKeyboardMarkup(inline_keyboard=[
        [
            InlineKeyboardButton(text="✅ 确认发送", callback_data="broadcast:confirm"),
            InlineKeyboardButton(text="❌ 取消", callback_data="broadcast:cancel"),
        ],
    ])
    await message.answer(
        f"📢 <b>广播预览</b>\n\n"
        f"内容：{html.escape(preview[:200])}\n"
        f"类型：{content_type}\n"
        f"接收人数：<b>{user_count}</b>\n\n"
        f"确认发送？",
        reply_markup=kb,
        parse_mode="HTML",
    )


# ============================================================
# 确认发送
# ============================================================

@router.callback_query(BroadcastStates.confirming, F.data == "broadcast:confirm")
async def confirm_broadcast(callback: CallbackQuery, state: FSMContext, bot: Bot):
    """确认并执行广播"""
    data = await state.get_data()
    content_type = data.get("content_type", "text")
    text = data.get("text", "")
    file_id = data.get("file_id", "")

    await state.clear()
    await callback.message.edit_text("⏳ 正在发送广播，请稍候...")
    await callback.answer()

    users = await get_all_users()
    sent_count = 0
    failed_count = 0

    for user in users:
        uid = user["user_id"]
        try:
            if content_type == "text":
                await bot.send_message(uid, text)
            elif content_type == "photo":
                await bot.send_photo(uid, file_id, caption=text or None)
            elif content_type == "video":
                await bot.send_video(uid, file_id, caption=text or None)
            sent_count += 1
        except Exception as e:
            logger.warning(f"广播发送失败（用户 {uid}）：{e}")
            failed_count += 1

    # 保存广播记录
    await save_broadcast(
        sender_id=callback.from_user.id,
        content_type=content_type,
        text=text,
        file_id=file_id,
        sent_count=sent_count,
        failed_count=failed_count,
    )

    kb = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="🔙 返回管理菜单", callback_data="admin_menu")],
    ])
    await callback.message.edit_text(
        f"✅ <b>广播发送完成</b>\n\n"
        f"• 成功：{sent_count} 人\n"
        f"• 失败：{failed_count} 人\n"
        f"• 总计：{sent_count + failed_count} 人",
        reply_markup=kb,
        parse_mode="HTML",
    )
    logger.info(f"管理员 {callback.from_user.id} 发送广播：成功 {sent_count}，失败 {failed_count}")


# ============================================================
# 广播历史
# ============================================================

@router.callback_query(F.data == "broadcast:history")
async def broadcast_history(callback: CallbackQuery):
    """查看广播历史"""
    if not config.is_admin(callback.from_user.id):
        await callback.answer("❌ 无权限", show_alert=True)
        return

    records = await get_broadcasts(10)
    if not records:
        text = "📋 暂无广播记录"
    else:
        text = "📋 <b>最近广播记录</b>\n\n"
        for r in records:
            content_preview = (r.get("text") or "")[:50]
            text += (
                f"• [{r['created_at'][:10]}] {r['content_type']}: "
                f"{html.escape(content_preview)}\n"
                f"  ✅ {r['sent_count']} | ❌ {r['failed_count']}\n\n"
            )

    kb = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="🔙 返回", callback_data="admin:broadcast")],
    ])
    await callback.message.edit_text(text, reply_markup=kb, parse_mode="HTML")
    await callback.answer()


# ============================================================
# 取消广播
# ============================================================

@router.callback_query(F.data == "broadcast:cancel")
async def cancel_broadcast(callback: CallbackQuery, state: FSMContext):
    """取消广播"""
    await state.clear()
    await callback.message.edit_text("❌ 广播已取消")
    await callback.answer()
