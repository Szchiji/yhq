"""
管理员菜单和审核处理模块
"""
import html as html_module
import logging

from aiogram import Router, F
from aiogram.types import (
    Message, CallbackQuery,
    InlineKeyboardMarkup, InlineKeyboardButton,
)
from aiogram.fsm.context import FSMContext
from aiogram.filters import Command

from config import config
from database import (
    get_pending_reports,
    get_pending_report_by_id,
    get_report_screenshots,
    approve_report,
    reject_report,
    get_ranking,
    delete_teacher_evaluations,
    get_blacklist,
    add_to_blacklist,
    remove_from_blacklist,
    get_required_channels,
    add_required_channel,
    remove_required_channel,
    get_report_channels,
    add_report_channel,
    remove_report_channel,
    get_total_stats,
    get_template_config,
)
from states import AdminStates

logger = logging.getLogger(__name__)
router = Router()


# ============================================================
# 管理员菜单
# ============================================================

@router.message(Command("admin"))
async def admin_command(message: Message, state: FSMContext):
    """管理员命令入口"""
    if not config.is_admin(message.from_user.id):
        await message.answer("❌ 您没有管理员权限")
        return
    await state.clear()
    await show_admin_menu(message)


@router.callback_query(F.data == "admin_menu")
async def admin_menu_callback(callback: CallbackQuery, state: FSMContext):
    """管理员菜单回调"""
    if not config.is_admin(callback.from_user.id):
        await callback.answer("❌ 无权限", show_alert=True)
        return
    await state.clear()
    await callback.message.edit_text(
        _admin_menu_text(),
        reply_markup=_admin_menu_keyboard(),
        parse_mode="Markdown",
    )
    await callback.answer()


async def show_admin_menu(message: Message):
    """展示管理员菜单"""
    await message.answer(
        _admin_menu_text(),
        reply_markup=_admin_menu_keyboard(),
        parse_mode="Markdown",
    )


def _admin_menu_text() -> str:
    return "🛠 **管理员菜单**\n\n请选择要管理的功能："


def _admin_menu_keyboard() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(inline_keyboard=[
        [
            InlineKeyboardButton(text="📊 快速评价管理", callback_data="admin:eval_menu"),
            InlineKeyboardButton(text="📋 报告审核", callback_data="admin:review_menu"),
        ],
        [
            InlineKeyboardButton(text="📢 频道管理", callback_data="admin:channel_menu"),
            InlineKeyboardButton(text="👥 用户管理", callback_data="admin:user_menu"),
        ],
        [
            InlineKeyboardButton(text="🎨 模板管理", callback_data="admin:template_menu"),
            InlineKeyboardButton(text="📈 数据统计", callback_data="admin:stats"),
        ],
        [
            InlineKeyboardButton(text="🔙 返回主菜单", callback_data="main_menu"),
        ],
    ])


# ============================================================
# 快速评价管理
# ============================================================

@router.callback_query(F.data == "admin:eval_menu")
async def eval_menu(callback: CallbackQuery):
    """快速评价管理菜单"""
    kb = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="🏆 查看排行榜", callback_data="admin:ranking")],
        [InlineKeyboardButton(text="🗑 删除教师评价", callback_data="admin:delete_eval")],
        [InlineKeyboardButton(text="🔙 返回", callback_data="admin_menu")],
    ])
    await callback.message.edit_text(
        "📊 **快速评价管理**",
        reply_markup=kb,
        parse_mode="Markdown",
    )
    await callback.answer()


@router.callback_query(F.data == "admin:ranking")
async def admin_ranking(callback: CallbackQuery):
    """查看排行榜"""
    rankings = await get_ranking(config.RANKING_LIMIT)
    if not rankings:
        await callback.answer("暂无排行榜数据", show_alert=True)
        return

    text = "🏆 **推荐排行榜**\n━━━━━━━━━━━━━━━━━━━━\n"
    for i, r in enumerate(rankings):
        text += f"{i+1}. @{r['teacher_username']} — 👍{r['recommended']}/{r['total']}\n"

    kb = InlineKeyboardMarkup(inline_keyboard=[[
        InlineKeyboardButton(text="🔙 返回", callback_data="admin:eval_menu")
    ]])
    await callback.message.edit_text(text, reply_markup=kb, parse_mode="Markdown")
    await callback.answer()


@router.callback_query(F.data == "admin:delete_eval")
async def start_delete_eval(callback: CallbackQuery, state: FSMContext):
    """开始删除教师评价"""
    await state.set_state(AdminStates.deleting_data)
    kb = InlineKeyboardMarkup(inline_keyboard=[[
        InlineKeyboardButton(text="❌ 取消", callback_data="admin:cancel")
    ]])
    await callback.message.answer(
        "🗑 请输入要删除评价的教师用户名（不含 @）：",
        reply_markup=kb,
    )
    await callback.answer()


@router.message(AdminStates.deleting_data, F.text)
async def receive_delete_username(message: Message, state: FSMContext):
    """接收要删除的教师用户名"""
    username = message.text.strip().lstrip("@")
    count = await delete_teacher_evaluations(username)
    await state.clear()
    await message.answer(f"✅ 已删除 @{username} 的 {count} 条评价记录")


# ============================================================
# 报告审核
# ============================================================

@router.callback_query(F.data == "admin:review_menu")
async def review_menu(callback: CallbackQuery):
    """报告审核菜单"""
    reports = await get_pending_reports(10)

    if not reports:
        kb = InlineKeyboardMarkup(inline_keyboard=[[
            InlineKeyboardButton(text="🔙 返回", callback_data="admin_menu")
        ]])
        await callback.message.edit_text(
            "📋 **报告审核**\n\n✅ 暂无待审核报告",
            reply_markup=kb,
            parse_mode="Markdown",
        )
        await callback.answer()
        return

    buttons = []
    for r in reports:
        teacher = r["teacher_username"]
        submitter = r.get("submitter_name", "未知")
        report_id = r["id"]
        buttons.append([
            InlineKeyboardButton(
                text=f"#{report_id} @{teacher} — 提交人：{submitter}",
                callback_data=f"admin:review:{report_id}"
            )
        ])
    buttons.append([InlineKeyboardButton(text="🔙 返回", callback_data="admin_menu")])

    await callback.message.edit_text(
        f"📋 **待审核报告**（{len(reports)} 份）\n\n点击报告查看详情：",
        reply_markup=InlineKeyboardMarkup(inline_keyboard=buttons),
        parse_mode="Markdown",
    )
    await callback.answer()


@router.callback_query(F.data.startswith("admin:review:"))
async def review_report(callback: CallbackQuery):
    """查看单个待审核报告"""
    report_id = int(callback.data.split(":", 2)[2])
    report = await get_pending_report_by_id(report_id)

    if not report:
        await callback.answer("❌ 报告不存在", show_alert=True)
        return

    teacher = report["teacher_username"]
    form_data = report["form_data"]
    tags = report.get("tags", [])
    submitter = report.get("submitter_name", "未知")
    created_at = report.get("created_at", "")

    text = (
        f"📋 <b>报告 #{report_id}</b>\n"
        f"━━━━━━━━━━━━━━━━━━━━\n"
        f"👤 教师：@{html_module.escape(teacher)}\n"
        f"📤 提交人：{html_module.escape(submitter)}\n"
        f"📅 提交时间：{html_module.escape(created_at[:16] if created_at else '未知')}\n\n"
    )

    from database import get_template_fields
    fields = await get_template_fields()
    for field in fields:
        key = field["field_key"]
        label = field["field_label"]
        value = form_data.get(key, "（未填写）")
        text += f"<b>{html_module.escape(label)}：</b>{html_module.escape(str(value))}\n"

    if tags:
        text += f"\n🏷 标签：{' '.join('#'+html_module.escape(t) for t in tags)}"

    kb = InlineKeyboardMarkup(inline_keyboard=[
        [
            InlineKeyboardButton(text="✅ 通过", callback_data=f"admin:approve:{report_id}"),
            InlineKeyboardButton(text="❌ 驳回", callback_data=f"admin:reject:{report_id}"),
        ],
        [
            InlineKeyboardButton(text="📸 查看截图", callback_data=f"admin:screenshots:{report_id}"),
        ],
        [
            InlineKeyboardButton(text="🔙 返回审核列表", callback_data="admin:review_menu"),
        ],
    ])
    await callback.message.edit_text(text, reply_markup=kb, parse_mode="HTML")
    await callback.answer()


@router.callback_query(F.data.startswith("admin:screenshots:"))
async def view_screenshots(callback: CallbackQuery):
    """查看报告截图"""
    report_id = int(callback.data.split(":", 2)[2])
    screenshots = await get_report_screenshots(report_id, "pending")

    if not screenshots:
        await callback.answer("❌ 没有截图", show_alert=True)
        return

    await callback.answer(f"共 {len(screenshots)} 张截图")

    for i, file_id in enumerate(screenshots, 1):
        kb = None
        if i == len(screenshots):
            kb = InlineKeyboardMarkup(inline_keyboard=[[
                InlineKeyboardButton(
                    text="✅ 通过", callback_data=f"admin:approve:{report_id}"
                ),
                InlineKeyboardButton(
                    text="❌ 驳回", callback_data=f"admin:reject:{report_id}"
                ),
            ]])
        await callback.message.answer_photo(
            file_id,
            caption=f"📸 截图 {i}/{len(screenshots)}",
            reply_markup=kb,
        )


@router.callback_query(F.data.startswith("admin:approve:"))
async def approve_report_callback(callback: CallbackQuery):
    """通过报告"""
    report_id = int(callback.data.split(":", 2)[2])
    report = await approve_report(report_id)

    if not report:
        await callback.answer("❌ 报告不存在或已处理", show_alert=True)
        return

    published_id = report.get("published_id")
    teacher = report["teacher_username"]
    submitter_id = report["submitter_id"]

    result_text = (
        f"✅ **报告 #{report_id} 已通过审核**\n\n"
        f"发布 ID：#{published_id}\n"
        f"教师：@{teacher}"
    )
    # 兼容图片消息（截图审核时回调附在图片上）
    try:
        if callback.message.photo or callback.message.document:
            await callback.message.edit_caption(result_text, parse_mode="Markdown")
        else:
            await callback.message.edit_text(result_text, parse_mode="Markdown")
    except Exception as e:
        logger.warning(f"编辑审核消息失败：{e}")
        try:
            await callback.message.answer(result_text, parse_mode="Markdown")
        except Exception:
            pass

    # 推送到报告频道
    report_channels = await get_report_channels()
    if report_channels:
        await _push_report_to_channels(callback.bot, report, report_channels)

    # 通知提交者
    try:
        await callback.bot.send_message(
            submitter_id,
            f"🎉 **您的报告已审核通过！**\n\n"
            f"关于 @{teacher} 的报告已发布。\n"
            f"发布 ID：#{published_id}",
            parse_mode="Markdown",
        )
    except Exception as e:
        logger.warning(f"无法通知用户 {submitter_id}: {e}")

    await callback.answer("✅ 已通过")


async def _push_report_to_channels(bot, report: dict, channels: list):
    """推送报告到频道"""
    from database import get_template_fields, update_published_report_message_ids

    fields = await get_template_fields()
    form_data = report["form_data"]
    teacher = report["teacher_username"]
    tags = report.get("tags", [])
    published_id = report.get("published_id")

    header = await get_template_config("header") or "📋 **教师评价报告**\n"
    footer = await get_template_config("footer") or "\n💡 _本报告由用户自主提交_"

    text = header + f"\n👤 教师：@{teacher}\n\n"
    for field in fields:
        key = field["field_key"]
        label = field["field_label"]
        value = form_data.get(key)
        if value:
            text += f"**{label}：**{value}\n"

    if tags:
        text += f"\n🏷 标签：{' '.join('#'+t for t in tags)}"

    text += footer

    message_ids = []
    for ch in channels:
        try:
            msg = await bot.send_message(
                ch["channel_id"],
                text,
                parse_mode="Markdown",
            )
            message_ids.append(msg.message_id)
        except Exception as e:
            logger.error(f"推送到频道 {ch['channel_id']} 失败: {e}")

    if published_id and message_ids:
        await update_published_report_message_ids(published_id, message_ids)


@router.callback_query(F.data.startswith("admin:reject:"))
async def reject_report_callback(callback: CallbackQuery):
    """驳回报告"""
    report_id = int(callback.data.split(":", 2)[2])
    report = await get_pending_report_by_id(report_id)

    if not report:
        await callback.answer("❌ 报告不存在", show_alert=True)
        return

    success = await reject_report(report_id)
    if success:
        submitter_id = report["submitter_id"]
        teacher = report["teacher_username"]

        result_text = f"❌ **报告 #{report_id} 已驳回**\n教师：@{teacher}"
        # 兼容图片消息（截图审核时回调附在图片上）
        try:
            if callback.message.photo or callback.message.document:
                await callback.message.edit_caption(result_text, parse_mode="Markdown")
            else:
                await callback.message.edit_text(result_text, parse_mode="Markdown")
        except Exception as e:
            logger.warning(f"编辑驳回消息失败：{e}")
            try:
                await callback.message.answer(result_text, parse_mode="Markdown")
            except Exception:
                pass

        # 通知提交者
        try:
            await callback.bot.send_message(
                submitter_id,
                f"❌ **您的报告未通过审核**\n\n"
                f"关于 @{teacher} 的报告已被管理员驳回。\n"
                f"如有疑问请联系管理员。",
                parse_mode="Markdown",
            )
        except Exception as e:
            logger.warning(f"无法通知用户 {submitter_id}: {e}")

        await callback.answer("❌ 已驳回")
    else:
        await callback.answer("❌ 操作失败", show_alert=True)


# ============================================================
# 频道管理
# ============================================================

@router.callback_query(F.data == "admin:channel_menu")
async def channel_menu(callback: CallbackQuery):
    """频道管理菜单"""
    kb = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="📢 强制订阅频道", callback_data="admin:req_channels")],
        [InlineKeyboardButton(text="📤 报告推送频道", callback_data="admin:report_channels")],
        [InlineKeyboardButton(text="🔙 返回", callback_data="admin_menu")],
    ])
    await callback.message.edit_text(
        "📢 **频道管理**",
        reply_markup=kb,
        parse_mode="Markdown",
    )
    await callback.answer()


@router.callback_query(F.data == "admin:req_channels")
async def manage_required_channels(callback: CallbackQuery):
    """管理强制订阅频道"""
    channels = await get_required_channels()
    buttons = []
    for ch in channels:
        name = ch.get("channel_name") or str(ch["channel_id"])
        buttons.append([
            InlineKeyboardButton(text=name, callback_data="admin:noop"),
            InlineKeyboardButton(
                text="🗑 删除",
                callback_data=f"admin:del_req_ch:{ch['channel_id']}"
            ),
        ])
    buttons.append([InlineKeyboardButton(text="➕ 添加频道", callback_data="admin:add_req_ch")])
    buttons.append([InlineKeyboardButton(text="🔙 返回", callback_data="admin:channel_menu")])

    await callback.message.edit_text(
        f"📢 **强制订阅频道**（{len(channels)} 个）",
        reply_markup=InlineKeyboardMarkup(inline_keyboard=buttons),
        parse_mode="Markdown",
    )
    await callback.answer()


@router.callback_query(F.data == "admin:add_req_ch")
async def add_required_channel_start(callback: CallbackQuery, state: FSMContext):
    """开始添加强制订阅频道"""
    await state.set_state(AdminStates.adding_channel)
    await state.update_data(channel_type="required")
    kb = InlineKeyboardMarkup(inline_keyboard=[[
        InlineKeyboardButton(text="❌ 取消", callback_data="admin:cancel")
    ]])
    await callback.message.answer(
        "📢 请发送频道 ID（格式：-100XXXXXXXXX）\n或将机器人加入频道后转发一条消息：",
        reply_markup=kb,
    )
    await callback.answer()


@router.callback_query(F.data.startswith("admin:del_req_ch:"))
async def delete_required_channel(callback: CallbackQuery):
    """删除强制订阅频道"""
    channel_id = int(callback.data.split(":", 2)[2])
    success = await remove_required_channel(channel_id)
    if success:
        await callback.answer("✅ 已删除")
        await manage_required_channels(callback)
    else:
        await callback.answer("❌ 删除失败", show_alert=True)


@router.callback_query(F.data == "admin:report_channels")
async def manage_report_channels(callback: CallbackQuery):
    """管理报告推送频道"""
    channels = await get_report_channels()
    buttons = []
    for ch in channels:
        name = ch.get("channel_name") or str(ch["channel_id"])
        buttons.append([
            InlineKeyboardButton(text=name, callback_data="admin:noop"),
            InlineKeyboardButton(
                text="🗑 删除",
                callback_data=f"admin:del_rpt_ch:{ch['channel_id']}"
            ),
        ])
    buttons.append([InlineKeyboardButton(text="➕ 添加频道", callback_data="admin:add_rpt_ch")])
    buttons.append([InlineKeyboardButton(text="🔙 返回", callback_data="admin:channel_menu")])

    await callback.message.edit_text(
        f"📤 **报告推送频道**（{len(channels)} 个）",
        reply_markup=InlineKeyboardMarkup(inline_keyboard=buttons),
        parse_mode="Markdown",
    )
    await callback.answer()


@router.callback_query(F.data == "admin:add_rpt_ch")
async def add_report_channel_start(callback: CallbackQuery, state: FSMContext):
    """开始添加报告推送频道"""
    await state.set_state(AdminStates.adding_channel)
    await state.update_data(channel_type="report")
    kb = InlineKeyboardMarkup(inline_keyboard=[[
        InlineKeyboardButton(text="❌ 取消", callback_data="admin:cancel")
    ]])
    await callback.message.answer(
        "📤 请发送频道 ID（格式：-100XXXXXXXXX）：",
        reply_markup=kb,
    )
    await callback.answer()


@router.message(AdminStates.adding_channel, F.text)
async def receive_channel_id(message: Message, state: FSMContext):
    """接收频道 ID"""
    text = message.text.strip()
    data = await state.get_data()
    channel_type = data.get("channel_type", "required")

    try:
        channel_id = int(text)
    except ValueError:
        await message.answer("⚠️ 请输入有效的频道 ID（纯数字格式，如 -1001234567890）")
        return

    # 尝试获取频道信息
    channel_name = ""
    try:
        chat = await message.bot.get_chat(channel_id)
        channel_name = chat.title or str(channel_id)
    except Exception:
        channel_name = str(channel_id)

    if channel_type == "required":
        await add_required_channel(channel_id, channel_name)
    else:
        await add_report_channel(channel_id, channel_name)

    await state.clear()
    type_text = "强制订阅" if channel_type == "required" else "报告推送"
    await message.answer(f"✅ 已添加{type_text}频道：**{channel_name}**", parse_mode="Markdown")


@router.callback_query(F.data.startswith("admin:del_rpt_ch:"))
async def delete_report_channel(callback: CallbackQuery):
    """删除报告推送频道"""
    channel_id = int(callback.data.split(":", 2)[2])
    success = await remove_report_channel(channel_id)
    if success:
        await callback.answer("✅ 已删除")
        await manage_report_channels(callback)
    else:
        await callback.answer("❌ 删除失败", show_alert=True)


# ============================================================
# 用户管理
# ============================================================

@router.callback_query(F.data == "admin:user_menu")
async def user_menu(callback: CallbackQuery):
    """用户管理菜单"""
    kb = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="🚫 查看黑名单", callback_data="admin:blacklist")],
        [InlineKeyboardButton(text="➕ 加入黑名单", callback_data="admin:add_blacklist")],
        [InlineKeyboardButton(text="🔙 返回", callback_data="admin_menu")],
    ])
    await callback.message.edit_text(
        "👥 **用户管理**",
        reply_markup=kb,
        parse_mode="Markdown",
    )
    await callback.answer()


@router.callback_query(F.data == "admin:blacklist")
async def view_blacklist(callback: CallbackQuery):
    """查看黑名单"""
    blacklist = await get_blacklist(20)

    if not blacklist:
        kb = InlineKeyboardMarkup(inline_keyboard=[[
            InlineKeyboardButton(text="🔙 返回", callback_data="admin:user_menu")
        ]])
        await callback.message.edit_text(
            "🚫 **黑名单**\n\n暂无黑名单用户",
            reply_markup=kb,
            parse_mode="Markdown",
        )
        await callback.answer()
        return

    buttons = []
    for user in blacklist:
        user_id = user["user_id"]
        user_name = user.get("user_name") or str(user_id)
        buttons.append([
            InlineKeyboardButton(text=user_name, callback_data="admin:noop"),
            InlineKeyboardButton(text="✅ 解除", callback_data=f"admin:unban:{user_id}"),
        ])
    buttons.append([InlineKeyboardButton(text="🔙 返回", callback_data="admin:user_menu")])

    await callback.message.edit_text(
        f"🚫 **黑名单**（{len(blacklist)} 人）",
        reply_markup=InlineKeyboardMarkup(inline_keyboard=buttons),
        parse_mode="Markdown",
    )
    await callback.answer()


@router.callback_query(F.data == "admin:add_blacklist")
async def add_to_blacklist_start(callback: CallbackQuery, state: FSMContext):
    """开始添加黑名单"""
    await state.set_state(AdminStates.managing_blacklist)
    kb = InlineKeyboardMarkup(inline_keyboard=[[
        InlineKeyboardButton(text="❌ 取消", callback_data="admin:cancel")
    ]])
    await callback.message.answer(
        "🚫 请输入要加入黑名单的用户 ID：",
        reply_markup=kb,
    )
    await callback.answer()


@router.message(AdminStates.managing_blacklist, F.text)
async def receive_blacklist_user_id(message: Message, state: FSMContext):
    """接收黑名单用户 ID"""
    text = message.text.strip()
    try:
        user_id = int(text)
    except ValueError:
        await message.answer("⚠️ 请输入有效的用户 ID（纯数字）")
        return

    await add_to_blacklist(user_id, str(user_id))
    await state.clear()
    await message.answer(f"✅ 用户 {user_id} 已加入黑名单")


@router.callback_query(F.data.startswith("admin:unban:"))
async def unban_user(callback: CallbackQuery):
    """解除黑名单"""
    user_id = int(callback.data.split(":", 2)[2])
    success = await remove_from_blacklist(user_id)
    if success:
        await callback.answer("✅ 已解除黑名单")
        await view_blacklist(callback)
    else:
        await callback.answer("❌ 操作失败", show_alert=True)


# ============================================================
# 数据统计
# ============================================================

@router.callback_query(F.data == "admin:stats")
async def admin_stats(callback: CallbackQuery):
    """显示数据统计"""
    stats = await get_total_stats()

    text = (
        "📈 **平台数据统计**\n"
        "━━━━━━━━━━━━━━━━━━━━\n"
        f"👤 收录教师数：{stats['teacher_count']}\n"
        f"⚡ 快速评价总数：{stats['total_evaluations']}\n"
        f"📋 待审核报告：{stats['pending_reports']}\n"
        f"✅ 已发布报告：{stats['published_reports']}\n"
        "━━━━━━━━━━━━━━━━━━━━"
    )

    kb = InlineKeyboardMarkup(inline_keyboard=[[
        InlineKeyboardButton(text="🔙 返回", callback_data="admin_menu")
    ]])
    await callback.message.edit_text(text, reply_markup=kb, parse_mode="Markdown")
    await callback.answer()


# ============================================================
# 通用取消
# ============================================================

@router.callback_query(F.data == "admin:cancel")
async def admin_cancel(callback: CallbackQuery, state: FSMContext):
    """取消管理员操作"""
    await state.clear()
    await callback.message.edit_text("❌ 已取消操作")
    await callback.answer()


@router.callback_query(F.data == "admin:noop")
async def admin_noop(callback: CallbackQuery):
    """空操作"""
    await callback.answer()
