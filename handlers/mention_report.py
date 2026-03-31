"""
报告查询处理模块
支持在群组和私聊中通过 @用户名 查看该用户的详细报告列表
"""
import logging

from aiogram import Router, F
from aiogram.types import Message, CallbackQuery, InlineKeyboardMarkup, InlineKeyboardButton

from database import (
    get_published_reports_by_teacher,
    get_published_report_by_id,
    get_report_screenshots,
    get_template_fields,
)

logger = logging.getLogger(__name__)
router = Router()

# 每页显示的报告数量
_PAGE_SIZE = 5


def _pub_date(report: dict) -> str:
    """安全地从报告中提取发布日期（前10位）"""
    return (report.get("published_at") or "")[:10]


def _build_report_list_keyboard(
    username: str,
    reports: list,
    page: int,
    total: int,
) -> InlineKeyboardMarkup:
    """构建报告列表内联键盘"""
    buttons = []

    start = page * _PAGE_SIZE
    page_reports = reports[start: start + _PAGE_SIZE]

    for report in page_reports:
        pub_date = _pub_date(report)
        buttons.append([
            InlineKeyboardButton(
                text=f"📄 报告 #{report['id']}  {pub_date}",
                callback_data=f"rpt:view:{report['id']}:{username}:{page}",
            )
        ])

    # 分页导航
    nav = []
    if page > 0:
        nav.append(InlineKeyboardButton(text="◀ 上一页", callback_data=f"rpt:page:{username}:{page - 1}"))
    total_pages = (total + _PAGE_SIZE - 1) // _PAGE_SIZE
    if (page + 1) < total_pages:
        nav.append(InlineKeyboardButton(text="下一页 ▶", callback_data=f"rpt:page:{username}:{page + 1}"))
    if nav:
        buttons.append(nav)

    buttons.append([
        InlineKeyboardButton(text="❌ 关闭", callback_data="rpt:close")
    ])
    return InlineKeyboardMarkup(inline_keyboard=buttons)


async def send_report_list(target, username: str, page: int = 0):
    """发送报告列表消息（target 可以是 Message 或 CallbackQuery.message）"""
    reports = await get_published_reports_by_teacher(username, limit=100)

    if not reports:
        text = f"❌ 未找到 @{username} 的报告"
        if isinstance(target, CallbackQuery):
            await target.answer(text, show_alert=True)
        else:
            await target.answer(text)
        return

    total = len(reports)
    total_pages = (total + _PAGE_SIZE - 1) // _PAGE_SIZE
    page = max(0, min(page, total_pages - 1))

    text = (
        f"📋 **@{username} 的报告**\n"
        f"共 {total} 条已发布报告（第 {page + 1}/{total_pages} 页）\n"
        f"━━━━━━━━━━━━━━━━━━━━\n"
    )

    start = page * _PAGE_SIZE
    page_reports = reports[start: start + _PAGE_SIZE]
    for i, report in enumerate(page_reports, start + 1):
        pub_date = _pub_date(report)
        # 取第一个非空字段作为预览
        form_data = report.get("form_data") or {}
        preview = ""
        for v in form_data.values():
            if v:
                v_str = str(v)
                preview = v_str[:40] + ("..." if len(v_str) > 40 else "")
                break
        tags = report.get("tags") or []
        tag_str = "  🏷 " + " ".join(f"#{t}" for t in tags) if tags else ""
        text += f"\n{i}. **报告 #{report['id']}**  {pub_date}\n"
        if preview:
            text += f"   {preview}\n"
        if tag_str:
            text += f"{tag_str}\n"

    kb = _build_report_list_keyboard(username, reports, page, total)

    if isinstance(target, CallbackQuery):
        try:
            await target.message.edit_text(text, reply_markup=kb, parse_mode="Markdown")
        except Exception as e:
            logger.debug(f"编辑消息失败，改为发送新消息：{e}")
            await target.message.answer(text, reply_markup=kb, parse_mode="Markdown")
        await target.answer()
    else:
        await target.answer(text, reply_markup=kb, parse_mode="Markdown")


# ============================================================
# 回调处理：分页导航
# ============================================================

@router.callback_query(F.data.startswith("rpt:page:"))
async def handle_report_page(callback: CallbackQuery):
    """翻页"""
    parts = callback.data.split(":", 3)
    # rpt:page:{username}:{page}
    if len(parts) < 4:
        await callback.answer()
        return
    username = parts[2]
    try:
        page = int(parts[3])
    except ValueError:
        page = 0
    await send_report_list(callback, username, page)


# ============================================================
# 回调处理：查看单条报告详情
# ============================================================

@router.callback_query(F.data.startswith("rpt:view:"))
async def handle_view_report(callback: CallbackQuery):
    """查看单条报告详情"""
    # rpt:view:{report_id}:{username}:{page}
    parts = callback.data.split(":", 4)
    if len(parts) < 5:
        await callback.answer("参数错误", show_alert=True)
        return
    try:
        report_id = int(parts[2])
    except ValueError:
        await callback.answer("参数错误", show_alert=True)
        return
    back_username = parts[3]
    try:
        back_page = int(parts[4])
    except ValueError:
        back_page = 0

    report = await get_published_report_by_id(report_id)
    if not report:
        await callback.answer("❌ 报告不存在", show_alert=True)
        return

    fields = await get_template_fields()
    form_data = report.get("form_data") or {}
    tags = report.get("tags") or []
    teacher = report.get("teacher_username", "")
    submitter = report.get("submitter_name") or "匿名"
    pub_date = _pub_date(report)

    text = (
        f"📋 **报告 #{report_id}**\n"
        f"━━━━━━━━━━━━━━━━━━━━\n"
        f"👤 教师：@{teacher}\n"
        f"✏️ 提交者：{submitter}\n"
        f"📅 发布时间：{pub_date}\n\n"
    )

    for field in fields:
        key = field["field_key"]
        label = field["field_label"]
        value = form_data.get(key, "")
        if value:
            text += f"**{label}：**{value}\n"

    if tags:
        text += f"\n🏷 标签：{' '.join('#' + t for t in tags)}"

    kb = InlineKeyboardMarkup(inline_keyboard=[
        [
            InlineKeyboardButton(
                text="📸 查看截图",
                callback_data=f"rpt:screenshots:{report_id}:{back_username}:{back_page}",
            )
        ],
        [
            InlineKeyboardButton(
                text="🔙 返回列表",
                callback_data=f"rpt:page:{back_username}:{back_page}",
            )
        ],
    ])

    try:
        await callback.message.edit_text(text, reply_markup=kb, parse_mode="Markdown")
    except Exception as e:
        logger.debug(f"编辑报告详情消息失败，改为发送新消息：{e}")
        await callback.message.answer(text, reply_markup=kb, parse_mode="Markdown")
    await callback.answer()


# ============================================================
# 回调处理：查看报告截图
# ============================================================

@router.callback_query(F.data.startswith("rpt:screenshots:"))
async def handle_view_screenshots(callback: CallbackQuery):
    """查看报告截图"""
    # rpt:screenshots:{report_id}:{username}:{page}
    parts = callback.data.split(":", 4)
    if len(parts) < 5:
        await callback.answer()
        return
    try:
        report_id = int(parts[2])
    except ValueError:
        await callback.answer("参数错误", show_alert=True)
        return
    back_username = parts[3]
    try:
        back_page = int(parts[4])
    except ValueError:
        back_page = 0

    screenshots = await get_report_screenshots(report_id, "published")
    if not screenshots:
        await callback.answer("❌ 该报告没有截图", show_alert=True)
        return

    await callback.answer()

    back_kb = InlineKeyboardMarkup(inline_keyboard=[[
        InlineKeyboardButton(
            text="🔙 返回报告",
            callback_data=f"rpt:view:{report_id}:{back_username}:{back_page}",
        )
    ]])

    for i, file_id in enumerate(screenshots, 1):
        try:
            caption = f"📸 报告 #{report_id} 截图 {i}/{len(screenshots)}"
            if i == len(screenshots):
                await callback.message.answer_photo(
                    file_id,
                    caption=caption,
                    reply_markup=back_kb,
                )
            else:
                await callback.message.answer_photo(file_id, caption=caption)
        except Exception as e:
            logger.warning(f"发送截图失败 file_id={file_id}: {e}")


# ============================================================
# 回调处理：关闭报告列表
# ============================================================

@router.callback_query(F.data == "rpt:close")
async def handle_close_report_list(callback: CallbackQuery):
    """关闭报告列表"""
    try:
        await callback.message.delete()
    except Exception as e:
        logger.debug(f"删除报告列表消息失败：{e}")
    await callback.answer()

