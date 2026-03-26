"""
自定义设置处理模块
管理员可以自定义 /start 欢迎页面和机器人设置
"""
import logging

from aiogram import Router, F
from aiogram.fsm.context import FSMContext
from aiogram.types import (
    Message,
    CallbackQuery,
    InlineKeyboardMarkup,
    InlineKeyboardButton,
)

from config import config
from database import (
    get_start_settings,
    save_start_settings,
    get_bot_setting,
    set_bot_setting,
)
from states import SettingsStates

logger = logging.getLogger(__name__)
router = Router()


# ============================================================
# 设置主菜单
# ============================================================

@router.callback_query(F.data == "admin:settings")
async def settings_menu(callback: CallbackQuery):
    """显示自定义设置菜单"""
    if not config.is_admin(callback.from_user.id):
        await callback.answer("❌ 无权限", show_alert=True)
        return

    kb = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="✏️ 自定义欢迎文本", callback_data="settings:edit_welcome")],
        [InlineKeyboardButton(text="🖼 设置欢迎图片", callback_data="settings:edit_photo")],
        [InlineKeyboardButton(text="🗑 清除欢迎图片", callback_data="settings:clear_photo")],
        [InlineKeyboardButton(text="👁 预览 /start 页面", callback_data="settings:preview")],
        [InlineKeyboardButton(text="🔙 返回管理菜单", callback_data="admin_menu")],
    ])
    await callback.message.edit_text(
        "⚙️ <b>自定义设置</b>\n\n选择要配置的项目：",
        reply_markup=kb,
        parse_mode="HTML",
    )
    await callback.answer()


# ============================================================
# 欢迎文本编辑
# ============================================================

@router.callback_query(F.data == "settings:edit_welcome")
async def edit_welcome_text(callback: CallbackQuery, state: FSMContext):
    """编辑欢迎文本"""
    if not config.is_admin(callback.from_user.id):
        await callback.answer("❌ 无权限", show_alert=True)
        return

    current = await get_bot_setting("start_welcome_text") or ""
    await state.set_state(SettingsStates.editing_start_text)

    kb = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="❌ 取消", callback_data="settings:cancel")],
    ])
    await callback.message.answer(
        f"✏️ <b>编辑欢迎文本</b>\n\n"
        f"当前内容：\n{current or '（未设置）'}\n\n"
        f"请输入新的欢迎文本（支持 HTML 格式）：",
        reply_markup=kb,
        parse_mode="HTML",
    )
    await callback.answer()


@router.message(SettingsStates.editing_start_text, F.text)
async def receive_welcome_text(message: Message, state: FSMContext):
    """接收新的欢迎文本"""
    new_text = message.text.strip()
    if not new_text:
        await message.answer("⚠️ 欢迎文本不能为空")
        return

    await save_start_settings(welcome_text=new_text)
    await state.clear()
    await message.answer("✅ 欢迎文本已更新")
    logger.info(f"管理员 {message.from_user.id} 更新了欢迎文本")


# ============================================================
# 欢迎图片设置
# ============================================================

@router.callback_query(F.data == "settings:edit_photo")
async def edit_welcome_photo(callback: CallbackQuery, state: FSMContext):
    """设置欢迎图片"""
    if not config.is_admin(callback.from_user.id):
        await callback.answer("❌ 无权限", show_alert=True)
        return

    await state.set_state(SettingsStates.editing_start_photo)

    kb = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="❌ 取消", callback_data="settings:cancel")],
    ])
    await callback.message.answer(
        "🖼 请发送您想设置为欢迎图片的图片：",
        reply_markup=kb,
    )
    await callback.answer()


@router.message(SettingsStates.editing_start_photo, F.photo)
async def receive_welcome_photo(message: Message, state: FSMContext):
    """接收欢迎图片"""
    photo = message.photo[-1]
    await save_start_settings(photo_file_id=photo.file_id)
    await state.clear()
    await message.answer("✅ 欢迎图片已更新")
    logger.info(f"管理员 {message.from_user.id} 更新了欢迎图片")


@router.callback_query(F.data == "settings:clear_photo")
async def clear_welcome_photo(callback: CallbackQuery):
    """清除欢迎图片"""
    if not config.is_admin(callback.from_user.id):
        await callback.answer("❌ 无权限", show_alert=True)
        return

    await save_start_settings(photo_file_id="")
    await callback.answer("✅ 欢迎图片已清除")
    await settings_menu(callback)


# ============================================================
# 预览 /start 页面
# ============================================================

@router.callback_query(F.data == "settings:preview")
async def preview_start(callback: CallbackQuery):
    """预览 /start 页面效果"""
    if not config.is_admin(callback.from_user.id):
        await callback.answer("❌ 无权限", show_alert=True)
        return

    settings = await get_start_settings()
    welcome_text = settings.get("start_welcome_text") or "👋 欢迎使用机器人！"
    photo_file_id = settings.get("start_photo_file_id") or ""

    kb = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="🔙 返回设置", callback_data="admin:settings")],
    ])

    if photo_file_id:
        try:
            await callback.message.answer_photo(
                photo=photo_file_id,
                caption=welcome_text,
                parse_mode="HTML",
                reply_markup=kb,
            )
        except Exception as e:
            logger.warning(f"发送欢迎图片失败：{e}")
            await callback.message.answer(
                f"<b>预览（图片加载失败）</b>\n\n{welcome_text}",
                reply_markup=kb,
                parse_mode="HTML",
            )
    else:
        await callback.message.answer(
            f"<b>预览</b>\n\n{welcome_text}",
            reply_markup=kb,
            parse_mode="HTML",
        )

    await callback.answer()


# ============================================================
# 取消设置
# ============================================================

@router.callback_query(F.data == "settings:cancel")
async def cancel_settings(callback: CallbackQuery, state: FSMContext):
    """取消设置操作"""
    await state.clear()
    await callback.message.edit_text("❌ 操作已取消")
    await callback.answer()
