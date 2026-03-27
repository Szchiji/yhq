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
from database import is_blacklisted, get_required_channels, upsert_user, get_start_settings, get_menu_keyboard_settings, get_ranking

logger = logging.getLogger(__name__)
router = Router()

# 可用的按钮动作映射
AVAILABLE_ACTIONS = {
    "main_menu": "🏠 首页",
    "help": "❓ 帮助",
    "ranking": "🏆 排行榜",
    "start_report": "📝 写报告",
}

# 每个用户最后一条导航消息 ID（用于编辑更新而非新建，限制最大 10000 个用户以防内存泄漏）
_last_nav_msg: dict[int, int] = {}
_LAST_NAV_MSG_MAXSIZE = 10_000


def _set_nav_msg(user_id: int, message_id: int) -> None:
    """记录用户最后的导航消息 ID，超出上限时清除最旧的条目"""
    if len(_last_nav_msg) >= _LAST_NAV_MSG_MAXSIZE:
        # 删除最旧的一半以避免频繁清理
        to_delete = list(_last_nav_msg.keys())[: _LAST_NAV_MSG_MAXSIZE // 2]
        for k in to_delete:
            _last_nav_msg.pop(k, None)
    _last_nav_msg[user_id] = message_id


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
    user_id = callback.from_user.id
    try:
        await callback.message.edit_text(
            _build_menu_text(),
            reply_markup=_build_menu_keyboard(user_id),
            parse_mode="Markdown",
        )
        _set_nav_msg(user_id, callback.message.message_id)
    except Exception:
        pass
    await callback.answer()


async def show_main_menu(message: Message):
    """展示主菜单（支持自定义欢迎文本和图片，合并底部键盘，不重复发送通知）"""
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
    reply_kb = await _build_reply_keyboard(user_id)

    # 如果底部键盘已启用，主消息使用底部键盘（省去独立通知消息）
    # 如果未启用，使用内联键盘
    markup = reply_kb if reply_kb else _build_menu_keyboard(user_id)

    if photo_file_id:
        try:
            msg = await message.answer_photo(
                photo=photo_file_id,
                caption=text,
                reply_markup=markup,
                parse_mode="Markdown",
            )
            _set_nav_msg(user_id, msg.message_id)
            return
        except Exception as e:
            logger.warning(f"发送欢迎图片失败：{e}")

    msg = await message.answer(text, reply_markup=markup, parse_mode="Markdown")
    _set_nav_msg(user_id, msg.message_id)


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
    """内联键盘（底部键盘禁用时使用）"""
    buttons = []
    if config.is_admin(user_id):
        buttons.append([
            InlineKeyboardButton(text="🛠 管理员菜单", callback_data="admin_menu")
        ])
    buttons.append([
        InlineKeyboardButton(text="❓ 使用帮助", callback_data="help")
    ])
    return InlineKeyboardMarkup(inline_keyboard=buttons)


async def _build_reply_keyboard(user_id: int) -> ReplyKeyboardMarkup | None:
    """构建底部快捷菜单键盘（从数据库读取配置，支持最多 4 个自定义按钮）"""
    try:
        settings = await get_menu_keyboard_settings()
        enabled_val = settings.get("menu_keyboard_enabled")
        if enabled_val == "0":
            return None

        # 收集已配置的按钮（文本非空）
        slots = [
            (settings.get("menu_btn_main") or "🏠 首页",     settings.get("menu_btn_main_action") or "main_menu"),
            (settings.get("menu_btn_help") or "❓ 帮助",     settings.get("menu_btn_help_action") or "help"),
            (settings.get("menu_btn_3") or "",               settings.get("menu_btn_3_action") or "ranking"),
            (settings.get("menu_btn_4") or "",               settings.get("menu_btn_4_action") or "start_report"),
        ]

        buttons_list: list[str] = []
        for text, _ in slots:
            if text.strip():
                buttons_list.append(text.strip())

        # 管理员额外获得管理员菜单按钮
        if config.is_admin(user_id):
            buttons_list.append("🛠 管理员菜单")

        if not buttons_list:
            return None

        # 每行排 2 个按钮
        keyboard = []
        for i in range(0, len(buttons_list), 2):
            row = [KeyboardButton(text=buttons_list[i])]
            if i + 1 < len(buttons_list):
                row.append(KeyboardButton(text=buttons_list[i + 1]))
            keyboard.append(row)

        return ReplyKeyboardMarkup(
            keyboard=keyboard,
            resize_keyboard=True,
            is_persistent=True,
        )
    except Exception as e:
        logger.warning(f"构建底部菜单键盘失败：{e}")
        return None


async def _build_ranking_text() -> str:
    """构建公开排行榜文本"""
    from config import config as cfg
    rankings = await get_ranking(cfg.RANKING_LIMIT)
    if not rankings:
        return "🏆 **推荐排行榜**\n\n暂无数据"
    text = "🏆 **推荐排行榜**\n━━━━━━━━━━━━━━━━━━━━\n"
    for i, r in enumerate(rankings, 1):
        total = r.get("total", 0)
        recommended = r.get("recommended", 0)
        pct = int(recommended / total * 100) if total > 0 else 0
        text += f"{i}. @{r['teacher_username']} — 👍{recommended}/{total}（{pct}%）\n"
    return text


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

async def _get_all_reply_buttons() -> list[tuple[str, str]]:
    """获取所有底部菜单按钮（文本, 动作）列表"""
    try:
        settings = await get_menu_keyboard_settings()
        slots = [
            (settings.get("menu_btn_main") or "🏠 首页",     settings.get("menu_btn_main_action") or "main_menu"),
            (settings.get("menu_btn_help") or "❓ 帮助",     settings.get("menu_btn_help_action") or "help"),
            (settings.get("menu_btn_3") or "",               settings.get("menu_btn_3_action") or "ranking"),
            (settings.get("menu_btn_4") or "",               settings.get("menu_btn_4_action") or "start_report"),
        ]
        return [(text.strip(), action) for text, action in slots if text.strip()]
    except Exception:
        return [("🏠 首页", "main_menu"), ("❓ 帮助", "help")]


async def _navigate(message: Message, text: str, kb: InlineKeyboardMarkup, user_id: int):
    """导航辅助：优先编辑上一条导航消息，失败则新建"""
    last_id = _last_nav_msg.get(user_id)
    if last_id:
        try:
            await message.bot.edit_message_text(
                text,
                chat_id=message.chat.id,
                message_id=last_id,
                reply_markup=kb,
                parse_mode="Markdown",
            )
            return
        except Exception:
            pass  # 编辑失败（消息太旧等），回退到新建
    msg = await message.answer(text, reply_markup=kb, parse_mode="Markdown")
    _set_nav_msg(user_id, msg.message_id)


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
    user_id = message.from_user.id
    all_buttons = await _get_all_reply_buttons()

    # 检查是否匹配配置的按钮
    matched_action = None
    for btn_text, action in all_buttons:
        if text == btn_text:
            matched_action = action
            break

    # 也检查管理员按钮
    if text == "🛠 管理员菜单" and config.is_admin(user_id):
        matched_action = "admin"

    if matched_action is None:
        return  # 不是底部菜单按钮，忽略

    await state.clear()

    if matched_action == "main_menu":
        menu_text = _build_menu_text()
        # 当底部键盘启用时，返回主页使用内联键盘（方便管理员访问管理入口）
        kb = _build_menu_keyboard(user_id)
        await _navigate(message, menu_text, kb, user_id)

    elif matched_action == "help":
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
        await _navigate(message, help_text, kb, user_id)

    elif matched_action == "ranking":
        ranking_text = await _build_ranking_text()
        kb = InlineKeyboardMarkup(inline_keyboard=[[
            InlineKeyboardButton(text="🔙 返回主菜单", callback_data="main_menu")
        ]])
        await _navigate(message, ranking_text, kb, user_id)

    elif matched_action == "start_report":
        prompt_text = (
            "📝 **写报告**\n\n"
            "请先在群组中输入 `@用户名` 查询该教师，\n"
            "然后点击统计卡片上的【📝 写报告】按钮开始填写。\n\n"
            "💡 例如：在群组输入 `@teacher123`"
        )
        kb = InlineKeyboardMarkup(inline_keyboard=[[
            InlineKeyboardButton(text="🔙 返回主菜单", callback_data="main_menu")
        ]])
        await _navigate(message, prompt_text, kb, user_id)

    elif matched_action == "admin":
        if config.is_admin(user_id):
            from handlers.admin import _admin_menu_text, _admin_menu_keyboard
            await _navigate(message, _admin_menu_text(), _admin_menu_keyboard(), user_id)
