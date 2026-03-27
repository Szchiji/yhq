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
    status = "✅ 已启用" if enabled else "❌ 已禁用"
    toggle_text = "🔴 禁用键盘" if enabled else "🟢 启用键盘"
    toggle_action = "settings:menu_kb_disable" if enabled else "settings:menu_kb_enable"

    # 读取各按钮配置
    btn_main = settings.get("menu_btn_main") or "🏠 首页"
    btn_main_action = settings.get("menu_btn_main_action") or "main_menu"
    btn_help = settings.get("menu_btn_help") or "❓ 帮助"
    btn_help_action = settings.get("menu_btn_help_action") or "help"
    btn_3 = settings.get("menu_btn_3") or ""
    btn_3_action = settings.get("menu_btn_3_action") or "ranking"
    btn_4 = settings.get("menu_btn_4") or ""
    btn_4_action = settings.get("menu_btn_4_action") or "start_report"

    action_names = {
        "main_menu": "首页", "help": "帮助",
        "ranking": "排行榜", "start_report": "写报告",
    }

    def btn_line(text: str, action: str, slot: str) -> str:
        a = action_names.get(action, action)
        if text:
            return f"[{text}]→{a}"
        return f"（未设置）→{a}"

    kb = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text=toggle_text, callback_data=toggle_action)],
        [InlineKeyboardButton(
            text=f"✏️ 按钮1：{btn_line(btn_main, btn_main_action, '1')}",
            callback_data="settings:menu_kb_slot:1"
        )],
        [InlineKeyboardButton(
            text=f"✏️ 按钮2：{btn_line(btn_help, btn_help_action, '2')}",
            callback_data="settings:menu_kb_slot:2"
        )],
        [InlineKeyboardButton(
            text=f"✏️ 按钮3：{btn_line(btn_3, btn_3_action, '3')}",
            callback_data="settings:menu_kb_slot:3"
        )],
        [InlineKeyboardButton(
            text=f"✏️ 按钮4：{btn_line(btn_4, btn_4_action, '4')}",
            callback_data="settings:menu_kb_slot:4"
        )],
        [InlineKeyboardButton(text="🔙 返回设置", callback_data="admin:settings")],
    ])
    await callback.message.edit_text(
        f"⌨️ <b>底部菜单键盘设置</b>\n\n"
        f"状态：{status}\n\n"
        f"支持最多 4 个按钮，每个按钮可配置显示文字和触发功能。\n"
        f"按钮3和按钮4文字留空则不显示。\n"
        f"可用功能：首页 / 帮助 / 排行榜 / 写报告",
        reply_markup=kb,
        parse_mode="HTML",
    )
    await callback.answer()


@router.callback_query(F.data.startswith("settings:menu_kb_slot:"))
async def edit_menu_kb_slot(callback: CallbackQuery, state: FSMContext):
    """编辑指定编号的按钮（文字和动作）"""
    if not config.is_admin(callback.from_user.id):
        await callback.answer("❌ 无权限", show_alert=True)
        return

    slot = callback.data.split(":")[-1]  # "1" / "2" / "3" / "4"
    settings = await get_menu_keyboard_settings()

    slot_map = {
        "1": ("menu_btn_main", "menu_btn_main_action", "🏠 首页", "main_menu"),
        "2": ("menu_btn_help", "menu_btn_help_action", "❓ 帮助", "help"),
        "3": ("menu_btn_3",    "menu_btn_3_action",    "",        "ranking"),
        "4": ("menu_btn_4",    "menu_btn_4_action",    "",        "start_report"),
    }
    if slot not in slot_map:
        await callback.answer("❌ 无效插槽", show_alert=True)
        return

    text_key, action_key, default_text, default_action = slot_map[slot]
    current_text = settings.get(text_key) or default_text
    current_action = settings.get(action_key) or default_action

    await state.set_state(SettingsStates.editing_start_buttons)
    await state.update_data(editing_slot=slot, editing_step="text", current_action=current_action)

    action_names = {
        "main_menu": "首页", "help": "帮助",
        "ranking": "排行榜", "start_report": "写报告",
    }

    # 动作选择按钮
    action_kb = InlineKeyboardMarkup(inline_keyboard=[
        [
            InlineKeyboardButton(text="🏠 首页", callback_data=f"settings:menu_kb_action:{slot}:main_menu"),
            InlineKeyboardButton(text="❓ 帮助", callback_data=f"settings:menu_kb_action:{slot}:help"),
        ],
        [
            InlineKeyboardButton(text="🏆 排行榜", callback_data=f"settings:menu_kb_action:{slot}:ranking"),
            InlineKeyboardButton(text="📝 写报告", callback_data=f"settings:menu_kb_action:{slot}:start_report"),
        ],
        [InlineKeyboardButton(text="❌ 取消", callback_data="settings:menu_keyboard")],
    ])
    await callback.message.edit_text(
        f"✏️ <b>编辑按钮 {slot}</b>\n\n"
        f"当前文字：{current_text or '（未设置）'}\n"
        f"当前功能：{action_names.get(current_action, current_action)}\n\n"
        f"请先选择此按钮触发的功能，然后再输入按钮显示文字：",
        reply_markup=action_kb,
        parse_mode="HTML",
    )
    await callback.answer()


@router.callback_query(F.data.startswith("settings:menu_kb_action:"))
async def set_menu_kb_action(callback: CallbackQuery, state: FSMContext):
    """选择按钮动作后，请求用户输入按钮文字"""
    if not config.is_admin(callback.from_user.id):
        await callback.answer("❌ 无权限", show_alert=True)
        return

    parts = callback.data.split(":")  # settings:menu_kb_action:{slot}:{action}
    slot = parts[3]
    action = parts[4]

    action_names = {
        "main_menu": "首页", "help": "帮助",
        "ranking": "排行榜", "start_report": "写报告",
    }
    action_label = action_names.get(action, action)

    slot_defaults = {"1": "🏠 首页", "2": "❓ 帮助", "3": "🏆 排行榜", "4": "📝 写报告"}
    default_text = slot_defaults.get(slot, "")

    await state.set_state(SettingsStates.editing_start_buttons)
    await state.update_data(editing_slot=slot, editing_step="text", pending_action=action)

    kb = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="❌ 取消", callback_data="settings:menu_keyboard")],
    ])
    clear_note = "\n如需清除此按钮，请输入「-」" if slot in ("3", "4") else ""
    await callback.message.edit_text(
        f"✏️ <b>按钮 {slot} → {action_label}</b>\n\n"
        f"请输入按钮的显示文字（可包含 emoji，建议不超过 10 个字符）：\n"
        f"例：{default_text}{clear_note}",
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


@router.message(SettingsStates.editing_start_buttons, F.text)
async def receive_menu_button_text(message: Message, state: FSMContext):
    """接收新的按钮文字并保存到指定插槽"""
    new_text = message.text.strip()
    data = await state.get_data()
    slot = data.get("editing_slot", "1")
    pending_action = data.get("pending_action", "")
    await state.clear()

    slot_map = {
        "1": ("menu_btn_main", "menu_btn_main_action"),
        "2": ("menu_btn_help", "menu_btn_help_action"),
        "3": ("menu_btn_3",    "menu_btn_3_action"),
        "4": ("menu_btn_4",    "menu_btn_4_action"),
    }
    text_kwarg, action_kwarg = slot_map.get(slot, ("btn_main", "btn_main_action"))

    # 允许用按「-」清除按钮3/4
    if new_text == "-" and slot in ("3", "4"):
        await save_menu_keyboard_settings(**{text_kwarg: ""})
        await message.answer(f"✅ 按钮 {slot} 已清除")
        logger.info(f"管理员 {message.from_user.id} 清除了按钮 {slot}")
        return

    if not new_text:
        await message.answer("⚠️ 按钮文字不能为空")
        return

    if len(new_text) > 20:
        await message.answer("⚠️ 按钮文字不能超过 20 个字符")
        return

    kwargs: dict = {text_kwarg: new_text}
    if pending_action:
        kwargs[action_kwarg] = pending_action

    await save_menu_keyboard_settings(**kwargs)

    action_names = {
        "main_menu": "首页", "help": "帮助",
        "ranking": "排行榜", "start_report": "写报告",
    }
    action_label = action_names.get(pending_action, pending_action) if pending_action else ""
    suffix = f"（功能：{action_label}）" if action_label else ""
    await message.answer(f"✅ 按钮 {slot} 已更新为：{new_text}{suffix}")
    logger.info(f"管理员 {message.from_user.id} 更新了按钮 {slot}：{new_text} → {pending_action}")
