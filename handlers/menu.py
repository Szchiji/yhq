"""
主菜单处理模块
"""
import logging

from aiogram import Router, F
from aiogram.filters import CommandStart, StateFilter
from aiogram.types import (
    Message, CallbackQuery,
    InlineKeyboardMarkup, InlineKeyboardButton,
    ReplyKeyboardMarkup, KeyboardButton,
)
from aiogram.fsm.context import FSMContext

from config import config
from database import is_blacklisted, get_required_channels, get_total_stats, upsert_user, get_start_settings, get_menu_keyboard_settings

logger = logging.getLogger(__name__)
router = Router()


async def check_subscription(bot, user_id: int) -> list:
    """检查用户是否订阅了所有强制频道，返回未订阅的频道列表"""
    channels = await get_required_channels()
    not_subscribed = []

    for ch in channels:
        try:
            member = await bot.get_chat_member(ch["channel_id"], user_id)
            if member.status in ("left", "kicked", "banned"):
                not_subscribed.append(ch)
        except Exception:
            pass

    return not_subscribed


def build_subscription_message(unsubscribed: list) -> tuple:
    """构建需要订阅的提示消息"""
    text = "⚠️ **请先订阅以下频道才能使用机器人：**\n\n"
    buttons = []
    for ch in unsubscribed:
        name = ch.get("channel_name") or str(ch["channel_id"])
        text += f"• {name}\n"
        # Build channel URL: private channels use t.me/c/{id_without_-100}/
        raw_id = str(ch["channel_id"])
        if raw_id.startswith("-100"):
            channel_url = f"https://t.me/c/{raw_id[4:]}/1"
        else:
            channel_url = f"https://t.me/c/{raw_id.lstrip('-')}/1"
        buttons.append([
            InlineKeyboardButton(text=f"📢 {name}", url=channel_url)
        ])
    buttons.append([
        InlineKeyboardButton(text="✅ 我已订阅，验证", callback_data="check_subscription")
    ])
    return text, InlineKeyboardMarkup(inline_keyboard=buttons)


@router.message(CommandStart())
async def start_handler(message: Message, state: FSMContext):
    """处理 /start 命令"""
    await state.clear()
    user_id = message.from_user.id

    # 记录用户（用于广播）
    try:
        await upsert_user(
            user_id=user_id,
            user_name=message.from_user.username or "",
            full_name=message.from_user.full_name or "",
        )
    except Exception as e:
        logger.warning(f"记录用户失败：{e}")

    # 检查黑名单
    if await is_blacklisted(user_id):
        await message.answer("❌ 您已被列入黑名单，无法使用本机器人。")
        return

    # 检查订阅
    unsubscribed = await check_subscription(message.bot, user_id)
    if unsubscribed:
        text, kb = build_subscription_message(unsubscribed)
        await message.answer(text, reply_markup=kb, parse_mode="Markdown")
        return

    # 显示欢迎菜单
    await show_main_menu(message)


@router.callback_query(F.data == "check_subscription")
async def verify_subscription_callback(callback: CallbackQuery, state: FSMContext):
    """验证订阅状态"""
    user_id = callback.from_user.id
    unsubscribed = await check_subscription(callback.bot, user_id)

    if unsubscribed:
        text, kb = build_subscription_message(unsubscribed)
        await callback.message.edit_text(text, reply_markup=kb, parse_mode="Markdown")
        await callback.answer("❌ 您还未订阅所有必要频道", show_alert=True)
    else:
        await callback.message.delete()
        await show_main_menu(callback.message)
        await callback.answer("✅ 验证通过！")


@router.callback_query(F.data == "main_menu")
async def back_to_main_menu(callback: CallbackQuery, state: FSMContext):
    """返回主菜单"""
    await state.clear()
    await callback.message.edit_text(
        _build_menu_text(),
        reply_markup=_build_menu_keyboard(callback.from_user.id),
        parse_mode="Markdown",
    )
    await callback.answer()


async def show_main_menu(message: Message):
    """展示主菜单（支持自定义欢迎文本和图片）"""
    user_id = message.from_user.id

    # 尝试读取自定义欢迎设置
    try:
        settings = await get_start_settings()
        custom_text = settings.get("start_welcome_text") or ""
        photo_file_id = settings.get("start_photo_file_id") or ""
    except Exception:
        custom_text = ""
        photo_file_id = ""

    text = custom_text if custom_text else _build_menu_text()
    inline_kb = _build_menu_keyboard(user_id)
    reply_kb = await _build_reply_keyboard()

    if photo_file_id:
        try:
            await message.answer_photo(
                photo=photo_file_id,
                caption=text,
                reply_markup=inline_kb,
                parse_mode="Markdown",
            )
            # Set the reply keyboard with a separate activation message
            if reply_kb:
                await message.answer("⌨️ 底部快捷菜单已就绪", reply_markup=reply_kb)
            return
        except Exception as e:
            logger.warning(f"发送欢迎图片失败：{e}")

    await message.answer(text, reply_markup=inline_kb, parse_mode="Markdown")
    # Set the reply keyboard with a separate activation message
    if reply_kb:
        await message.answer("⌨️ 底部快捷菜单已就绪", reply_markup=reply_kb)


def _build_menu_text() -> str:
    return (
        "👋 **欢迎使用教师评价平台！**\n\n"
        "🔍 **查询教师评价**\n"
        "在群组中输入 `@用户名` 查询教师评价统计\n\n"
        "🏷 **标签搜索**\n"
        "在群组中输入 `#标签` 搜索相关报告\n"
        "例如：`#龙岗` 或 `#龙岗 #竹竹`\n\n"
        "📋 **功能说明**\n"
        "• 👍 快速推荐/👎 不推荐\n"
        "• 📝 提交详细评价报告\n"
        "• 🔍 标签搜索功能"
    )


def _build_menu_keyboard(user_id: int) -> InlineKeyboardMarkup:
    buttons = []
    if config.is_admin(user_id):
        buttons.append([
            InlineKeyboardButton(text="🛠 管理员菜单", callback_data="admin_menu")
        ])
    buttons.append([
        InlineKeyboardButton(text="❓ 使用帮助", callback_data="help")
    ])
    return InlineKeyboardMarkup(inline_keyboard=buttons)


async def _build_reply_keyboard() -> ReplyKeyboardMarkup | None:
    """构建底部快捷菜单键盘（从数据库读取设置）"""
    try:
        settings = await get_menu_keyboard_settings()
        # 默认启用（首次使用时 setting 值为 None，视为启用）
        enabled_val = settings.get("menu_keyboard_enabled")
        if enabled_val == "0":
            return None
        btn_main = settings.get("menu_btn_main") or "🏠 主菜单"
        btn_help = settings.get("menu_btn_help") or "❓ 帮助"
        return ReplyKeyboardMarkup(
            keyboard=[
                [KeyboardButton(text=btn_main), KeyboardButton(text=btn_help)],
            ],
            resize_keyboard=True,
            is_persistent=True,
        )
    except Exception as e:
        logger.warning(f"构建底部菜单键盘失败：{e}")
        return None


@router.callback_query(F.data == "help")
async def help_callback(callback: CallbackQuery):
    """显示帮助信息"""
    text = (
        "📖 **使用帮助**\n\n"
        "**1️⃣ 查询教师评价**\n"
        "在群组中输入 `@用户名`（如 `@teacher123`）\n"
        "机器人会显示该教师的评价统计卡片\n\n"
        "**2️⃣ 快速评价**\n"
        "点击【👍推荐】或【👎不推荐】\n"
        "输入一句话理由（至少 12 个字）\n\n"
        "**3️⃣ 提交详细报告**\n"
        "点击【📝写报告】\n"
        "按步骤填写报告表单\n"
        "上传预约截图（1-3 张，必填）\n"
        "等待管理员审核通过后发布\n\n"
        "**4️⃣ 标签搜索**\n"
        "在群组中输入 `#标签名` 即可搜索\n"
        "支持多标签：`#龙岗 #竹竹`\n\n"
        "**5️⃣ 注意事项**\n"
        "• 每人每位教师只能进行一次快速评价\n"
        "• 报告需要管理员审核后才会公开\n"
        "• 请遵守平台规则，不得恶意评价"
    )
    kb = InlineKeyboardMarkup(inline_keyboard=[[
        InlineKeyboardButton(text="🔙 返回主菜单", callback_data="main_menu")
    ]])
    await callback.message.edit_text(text, reply_markup=kb, parse_mode="Markdown")
    await callback.answer()


# ============================================================
# 底部快捷菜单键盘按钮处理器
# ============================================================

async def _get_reply_button_texts() -> tuple[str, str]:
    """获取底部菜单按钮文本"""
    try:
        settings = await get_menu_keyboard_settings()
        btn_main = settings.get("menu_btn_main") or "🏠 主菜单"
        btn_help = settings.get("menu_btn_help") or "❓ 帮助"
        return btn_main, btn_help
    except Exception:
        return "🏠 主菜单", "❓ 帮助"


@router.message(
    StateFilter(None),
    F.chat.type == "private",
    F.text,
    ~F.text.startswith("@"),
    ~F.text.regexp(r"#\w+"),
)
async def reply_keyboard_handler(message: Message, state: FSMContext):
    """处理底部快捷菜单按钮文本消息（仅在无活动状态的私聊中生效）"""
    text = message.text or ""
    btn_main, btn_help = await _get_reply_button_texts()

    if text == btn_main:
        await state.clear()
        user_id = message.from_user.id
        await message.answer(
            _build_menu_text(),
            reply_markup=_build_menu_keyboard(user_id),
            parse_mode="Markdown",
        )
    elif text == btn_help:
        help_text = (
            "📖 **使用帮助**\n\n"
            "**1️⃣ 查询教师评价**\n"
            "在群组中输入 `@用户名`（如 `@teacher123`）\n"
            "机器人会显示该教师的评价统计卡片\n\n"
            "**2️⃣ 快速评价**\n"
            "点击【👍推荐】或【👎不推荐】\n"
            "输入一句话理由（至少 12 个字）\n\n"
            "**3️⃣ 提交详细报告**\n"
            "点击【📝写报告】\n"
            "按步骤填写报告表单\n"
            "上传预约截图（1-3 张，必填）\n"
            "等待管理员审核通过后发布\n\n"
            "**4️⃣ 标签搜索**\n"
            "在群组中输入 `#标签名` 即可搜索\n"
            "支持多标签：`#龙岗 #竹竹`\n\n"
            "**5️⃣ 注意事项**\n"
            "• 每人每位教师只能进行一次快速评价\n"
            "• 报告需要管理员审核后才会公开\n"
            "• 请遵守平台规则，不得恶意评价"
        )
        kb = InlineKeyboardMarkup(inline_keyboard=[[
            InlineKeyboardButton(text="🔙 返回主菜单", callback_data="main_menu")
        ]])
        await message.answer(help_text, reply_markup=kb, parse_mode="Markdown")
