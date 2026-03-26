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
    get_menu_keyboard_settings,
    save_menu_keyboard_settings,
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
        [InlineKeyboardButton(text="⌨️ 底部菜单键盘设置", callback_data="settings:menu_keyboard")],
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


# ============================================================
# 底部菜单键盘设置
# ============================================================

@router.callback_query(F.data == "settings:menu_keyboard")
async def menu_keyboard_menu(callback: CallbackQuery):
    """显示底部菜单键盘设置"""
    if not config.is_admin(callback.from_user.id):
        await callback.answer("❌ 无权限", show_alert=True)
        return

    settings = await get_menu_keyboard_settings()
    enabled_val = settings.get("menu_keyboard_enabled")
    enabled = enabled_val != "0"  # None 或 "1" 均视为启用
    btn_main = settings.get("menu_btn_main") or "🏠 主菜单"
    btn_help = settings.get("menu_btn_help") or "❓ 帮助"
    status = "✅ 已启用" if enabled else "❌ 已禁用"
    toggle_text = "🔴 禁用键盘" if enabled else "🟢 启用键盘"
    toggle_action = "settings:menu_kb_disable" if enabled else "settings:menu_kb_enable"

    kb = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text=toggle_text, callback_data=toggle_action)],
        [InlineKeyboardButton(text=f"✏️ 「主菜单」按钮文本：{btn_main}", callback_data="settings:menu_kb_btn_main")],
        [InlineKeyboardButton(text=f"✏️ 「帮助」按钮文本：{btn_help}", callback_data="settings:menu_kb_btn_help")],
        [InlineKeyboardButton(text="🔙 返回设置", callback_data="admin:settings")],
    ])
    await callback.message.edit_text(
        f"⌨️ <b>底部菜单键盘设置</b>\n\n"
        f"状态：{status}\n"
        f"当前按钮：[{btn_main}] [{btn_help}]\n\n"
        f"底部菜单键盘会在用户发送 /start 后显示在聊天底部，"
        f"方便用户快速访问常用功能。",
        reply_markup=kb,
        parse_mode="HTML",
    )
    await callback.answer()


@router.callback_query(F.data == "settings:menu_kb_enable")
async def enable_menu_keyboard(callback: CallbackQuery):
    """启用底部菜单键盘"""
    if not config.is_admin(callback.from_user.id):
        await callback.answer("❌ 无权限", show_alert=True)
        return
    await save_menu_keyboard_settings(enabled=True)
    await callback.answer("✅ 底部菜单键盘已启用")
    await menu_keyboard_menu(callback)


@router.callback_query(F.data == "settings:menu_kb_disable")
async def disable_menu_keyboard(callback: CallbackQuery):
    """禁用底部菜单键盘"""
    if not config.is_admin(callback.from_user.id):
        await callback.answer("❌ 无权限", show_alert=True)
        return
    await save_menu_keyboard_settings(enabled=False)
    await callback.answer("✅ 底部菜单键盘已禁用")
    await menu_keyboard_menu(callback)


@router.callback_query(F.data == "settings:menu_kb_btn_main")
async def edit_menu_btn_main(callback: CallbackQuery, state: FSMContext):
    """编辑「主菜单」按钮文本"""
    if not config.is_admin(callback.from_user.id):
        await callback.answer("❌ 无权限", show_alert=True)
        return
    await state.set_state(SettingsStates.editing_start_buttons)
    await state.update_data(editing_btn="main")
    kb = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="❌ 取消", callback_data="settings:cancel")],
    ])
    await callback.message.answer(
        "✏️ <b>编辑「主菜单」按钮文本</b>\n\n"
        "请输入新的按钮文字（可包含 emoji，建议不超过 10 个字符）：\n"
        "默认值：🏠 主菜单",
        reply_markup=kb,
        parse_mode="HTML",
    )
    await callback.answer()


@router.callback_query(F.data == "settings:menu_kb_btn_help")
async def edit_menu_btn_help(callback: CallbackQuery, state: FSMContext):
    """编辑「帮助」按钮文本"""
    if not config.is_admin(callback.from_user.id):
        await callback.answer("❌ 无权限", show_alert=True)
        return
    await state.set_state(SettingsStates.editing_start_buttons)
    await state.update_data(editing_btn="help")
    kb = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="❌ 取消", callback_data="settings:cancel")],
    ])
    await callback.message.answer(
        "✏️ <b>编辑「帮助」按钮文本</b>\n\n"
        "请输入新的按钮文字（可包含 emoji，建议不超过 10 个字符）：\n"
        "默认值：❓ 帮助",
        reply_markup=kb,
        parse_mode="HTML",
    )
    await callback.answer()


@router.message(SettingsStates.editing_start_buttons, F.text)
async def receive_menu_button_text(message: Message, state: FSMContext):
    """接收新的按钮文本"""
    new_text = message.text.strip()
    if not new_text:
        await message.answer("⚠️ 按钮文本不能为空")
        return

    if len(new_text) > 20:
        await message.answer("⚠️ 按钮文本不能超过 20 个字符")
        return

    data = await state.get_data()
    editing_btn = data.get("editing_btn", "main")
    await state.clear()

    if editing_btn == "main":
        await save_menu_keyboard_settings(btn_main=new_text)
        await message.answer(f"✅ 「主菜单」按钮文本已更新为：{new_text}")
    else:
        await save_menu_keyboard_settings(btn_help=new_text)
        await message.answer(f"✅ 「帮助」按钮文本已更新为：{new_text}")
    logger.info(f"管理员 {message.from_user.id} 更新了底部菜单按钮文本")
