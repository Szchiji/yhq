"""
报告表单处理模块
系统 B：详细报告，包含预约截图和标签
"""
import logging

from aiogram import Router, F
from aiogram.types import (
    Message, CallbackQuery,
    InlineKeyboardMarkup, InlineKeyboardButton,
    PhotoSize,
)
from aiogram.fsm.context import FSMContext

from config import config
from database import (
    get_template_fields,
    get_predefined_tags,
    get_tag_field_config,
    save_pending_report,
    save_report_screenshot,
    is_blacklisted,
)
from states import ReportFormStates

logger = logging.getLogger(__name__)
router = Router()


# ============================================================
# 开始填写报告
# ============================================================

@router.callback_query(F.data.startswith("report:start:"))
async def report_start(callback: CallbackQuery, state: FSMContext):
    """开始填写报告表单"""
    username = callback.data.split(":", 2)[2]
    user_id = callback.from_user.id

    # 检查黑名单
    if await is_blacklisted(user_id):
        await callback.answer("❌ 您已被封禁，无法提交报告", show_alert=True)
        return

    # 获取模板字段
    fields = await get_template_fields()
    if not fields:
        await callback.answer("⚠️ 模板字段未配置，请联系管理员", show_alert=True)
        return

    # 初始化状态
    await state.set_state(ReportFormStates.filling_field)
    await state.update_data(
        teacher_username=username,
        fields=fields,
        current_field_index=0,
        form_data={},
        screenshots=[],
        tags=[],
    )

    await callback.message.answer(
        f"📝 **开始填写 @{username} 的评价报告**\n\n"
        f"共需填写 {len(fields)} 个字段，请逐一回答。\n"
        f"输入 /cancel 取消填写。",
        parse_mode="Markdown",
    )
    await _ask_next_field(callback.message, state)
    await callback.answer()


async def _ask_next_field(message: Message, state: FSMContext):
    """询问下一个表单字段"""
    data = await state.get_data()
    fields = data["fields"]
    index = data["current_field_index"]

    if index >= len(fields):
        # 所有字段填完，进入截图上传
        await _start_screenshot_upload(message, state)
        return

    field = fields[index]
    label = field["field_label"]
    required_mark = " *" if field["is_required"] else " (可选)"

    kb = InlineKeyboardMarkup(inline_keyboard=[[
        InlineKeyboardButton(text="⏭ 跳过", callback_data="form:skip_field"),
        InlineKeyboardButton(text="❌ 取消", callback_data="form:cancel"),
    ]]) if not field["is_required"] else InlineKeyboardMarkup(inline_keyboard=[[
        InlineKeyboardButton(text="❌ 取消", callback_data="form:cancel"),
    ]])

    await message.answer(
        f"📋 **字段 {index + 1}/{len(fields)}：{label}{required_mark}**\n\n"
        f"请输入该字段的内容：",
        reply_markup=kb,
        parse_mode="Markdown",
    )


@router.message(ReportFormStates.filling_field, F.text)
async def receive_field_value(message: Message, state: FSMContext):
    """接收表单字段值"""
    if message.text == "/cancel":
        await _cancel_report(message, state)
        return

    data = await state.get_data()
    fields = data["fields"]
    index = data["current_field_index"]
    form_data = data["form_data"]

    if index < len(fields):
        field = fields[index]
        form_data[field["field_key"]] = message.text
        await state.update_data(
            form_data=form_data,
            current_field_index=index + 1,
        )

    await _ask_next_field(message, state)


@router.callback_query(F.data == "form:skip_field")
async def skip_field(callback: CallbackQuery, state: FSMContext):
    """跳过可选字段"""
    data = await state.get_data()
    await state.update_data(current_field_index=data["current_field_index"] + 1)
    await _ask_next_field(callback.message, state)
    await callback.answer()


@router.callback_query(F.data == "form:cancel")
async def cancel_form(callback: CallbackQuery, state: FSMContext):
    """取消填写"""
    await _cancel_report(callback.message, state)
    await callback.answer()


async def _cancel_report(message: Message, state: FSMContext):
    """取消报告填写"""
    await state.clear()
    await message.answer("❌ 已取消报告填写")


# ============================================================
# 上传预约截图
# ============================================================

async def _start_screenshot_upload(message: Message, state: FSMContext):
    """开始截图上传流程"""
    await state.set_state(ReportFormStates.uploading_screenshots)

    kb = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="✅ 截图已上传完毕", callback_data="form:screenshots_done")],
        [InlineKeyboardButton(text="❌ 取消", callback_data="form:cancel")],
    ])

    await message.answer(
        f"📸 **上传预约截图**\n\n"
        f"请上传 {config.MIN_SCREENSHOTS}-{config.MAX_SCREENSHOTS} 张预约截图（必填）\n"
        f"截图用于证明预约真实性\n\n"
        f"上传完成后点击【✅ 截图已上传完毕】",
        reply_markup=kb,
        parse_mode="Markdown",
    )


@router.message(ReportFormStates.uploading_screenshots, F.photo)
async def receive_screenshot(message: Message, state: FSMContext):
    """接收预约截图"""
    data = await state.get_data()
    screenshots: list = data.get("screenshots", [])

    if len(screenshots) >= config.MAX_SCREENSHOTS:
        await message.answer(
            f"⚠️ 最多只能上传 {config.MAX_SCREENSHOTS} 张截图，"
            f"请点击【✅ 截图已上传完毕】提交"
        )
        return

    # 获取最高分辨率的图片
    photo: PhotoSize = message.photo[-1]
    screenshots.append(photo.file_id)
    await state.update_data(screenshots=screenshots)

    kb = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="✅ 截图已上传完毕", callback_data="form:screenshots_done")],
        [InlineKeyboardButton(text="❌ 取消", callback_data="form:cancel")],
    ])

    await message.answer(
        f"✅ 截图 {len(screenshots)} 已收到！\n"
        f"当前已上传：{len(screenshots)}/{config.MAX_SCREENSHOTS} 张\n\n"
        f"继续上传或点击【✅ 截图已上传完毕】",
        reply_markup=kb,
    )


@router.callback_query(F.data == "form:screenshots_done")
async def screenshots_done(callback: CallbackQuery, state: FSMContext):
    """截图上传完毕"""
    data = await state.get_data()
    screenshots = data.get("screenshots", [])

    if len(screenshots) < config.MIN_SCREENSHOTS:
        await callback.answer(
            f"⚠️ 请至少上传 {config.MIN_SCREENSHOTS} 张预约截图",
            show_alert=True,
        )
        return

    # 进入标签输入
    await _start_tag_input(callback.message, state)
    await callback.answer()


# ============================================================
# 输入标签
# ============================================================

async def _start_tag_input(message: Message, state: FSMContext):
    """开始标签输入流程"""
    await state.set_state(ReportFormStates.entering_tags)

    tag_config = await get_tag_field_config()
    predefined = await get_predefined_tags()
    is_required = bool(tag_config.get("is_required", 0))
    max_tags = tag_config.get("max_tags", 5)

    required_text = "（必填）" if is_required else "（可选）"

    buttons = []
    if predefined:
        tag_buttons = []
        for tag in predefined[:8]:  # 最多显示8个预定义标签
            tag_buttons.append(
                InlineKeyboardButton(text=f"#{tag}", callback_data=f"tag:select:{tag}")
            )
        # 每行2个标签按钮
        for i in range(0, len(tag_buttons), 2):
            buttons.append(tag_buttons[i:i+2])

    action_buttons = [InlineKeyboardButton(text="✅ 完成标签", callback_data="form:tags_done")]
    if not is_required:
        action_buttons.append(InlineKeyboardButton(text="⏭ 跳过", callback_data="form:tags_done"))
    buttons.append(action_buttons)
    buttons.append([InlineKeyboardButton(text="❌ 取消", callback_data="form:cancel")])

    kb = InlineKeyboardMarkup(inline_keyboard=buttons)

    predefined_hint = f"\n预定义标签：{' '.join('#'+t for t in predefined[:8])}" if predefined else ""

    await message.answer(
        f"🏷 **添加标签** {required_text}\n\n"
        f"标签有助于其他用户搜索报告\n"
        f"最多添加 {max_tags} 个标签\n"
        f"{predefined_hint}\n\n"
        f"**方法：**\n"
        f"• 点击预定义标签直接添加\n"
        f"• 输入 `#标签名` 自定义添加\n"
        f"完成后点击【✅ 完成标签】",
        reply_markup=kb,
        parse_mode="Markdown",
    )


@router.callback_query(F.data.startswith("tag:select:"))
async def select_predefined_tag(callback: CallbackQuery, state: FSMContext):
    """选择预定义标签"""
    tag = callback.data.split(":", 2)[2]
    data = await state.get_data()
    tags: list = data.get("tags", [])
    tag_config = await get_tag_field_config()
    max_tags = tag_config.get("max_tags", 5)

    if tag in tags:
        await callback.answer(f"⚠️ 标签 #{tag} 已添加", show_alert=False)
        return

    if len(tags) >= max_tags:
        await callback.answer(f"⚠️ 最多添加 {max_tags} 个标签", show_alert=True)
        return

    tags.append(tag)
    await state.update_data(tags=tags)
    await callback.answer(f"✅ 已添加 #{tag}")
    await callback.message.answer(f"✅ 已添加标签：#{tag}\n当前标签：{' '.join('#'+t for t in tags)}")


@router.message(ReportFormStates.entering_tags, F.text)
async def receive_custom_tag(message: Message, state: FSMContext):
    """接收自定义标签"""
    text = message.text or ""

    if text == "/cancel":
        await _cancel_report(message, state)
        return

    # 解析 #标签
    import re
    found_tags = re.findall(r"#(\w+)", text)

    if not found_tags:
        await message.answer("⚠️ 请输入 #标签名 格式，例如：#龙岗")
        return

    data = await state.get_data()
    tags: list = data.get("tags", [])
    tag_config = await get_tag_field_config()
    max_tags = tag_config.get("max_tags", 5)

    added = []
    for tag in found_tags:
        if tag not in tags and len(tags) < max_tags:
            tags.append(tag)
            added.append(tag)

    await state.update_data(tags=tags)

    if added:
        await message.answer(
            f"✅ 已添加标签：{' '.join('#'+t for t in added)}\n"
            f"当前所有标签：{' '.join('#'+t for t in tags)}"
        )
    else:
        await message.answer("⚠️ 标签已存在或达到上限")


@router.callback_query(F.data == "form:tags_done")
async def tags_done(callback: CallbackQuery, state: FSMContext):
    """标签输入完毕"""
    data = await state.get_data()
    tags = data.get("tags", [])
    tag_config = await get_tag_field_config()
    is_required = bool(tag_config.get("is_required", 0))

    if is_required and not tags:
        await callback.answer("⚠️ 标签为必填项，请至少添加一个标签", show_alert=True)
        return

    # 进入预览
    await state.set_state(ReportFormStates.previewing)
    await _show_preview(callback.message, state)
    await callback.answer()


# ============================================================
# 预览和提交
# ============================================================

async def _show_preview(message: Message, state: FSMContext):
    """显示报告预览"""
    data = await state.get_data()
    teacher_username = data["teacher_username"]
    fields = data["fields"]
    form_data = data["form_data"]
    screenshots = data.get("screenshots", [])
    tags = data.get("tags", [])

    text = (
        f"📋 **报告预览**\n"
        f"━━━━━━━━━━━━━━━━━━━━\n"
        f"👤 教师：@{teacher_username}\n\n"
    )

    for field in fields:
        key = field["field_key"]
        label = field["field_label"]
        value = form_data.get(key, "（未填写）")
        text += f"**{label}：**{value}\n"

    if tags:
        text += f"\n🏷 标签：{' '.join('#'+t for t in tags)}"

    text += f"\n📸 预约截图：{len(screenshots)} 张"
    text += "\n━━━━━━━━━━━━━━━━━━━━"

    kb = InlineKeyboardMarkup(inline_keyboard=[
        [
            InlineKeyboardButton(text="✅ 提交审核", callback_data="form:submit"),
            InlineKeyboardButton(text="❌ 取消", callback_data="form:cancel"),
        ],
    ])

    await message.answer(text, reply_markup=kb, parse_mode="Markdown")


@router.callback_query(F.data == "form:submit")
async def submit_report(callback: CallbackQuery, state: FSMContext):
    """提交报告"""
    data = await state.get_data()
    teacher_username = data["teacher_username"]
    form_data = data["form_data"]
    screenshots = data.get("screenshots", [])
    tags = data.get("tags", [])

    user_id = callback.from_user.id
    user_name = callback.from_user.full_name or str(user_id)

    # 保存报告
    report_id = await save_pending_report(
        teacher_username=teacher_username,
        submitter_id=user_id,
        submitter_name=user_name,
        form_data=form_data,
        tags=tags,
    )

    # 保存截图
    for file_id in screenshots:
        await save_report_screenshot(report_id, "pending", file_id)

    await state.clear()

    await callback.message.edit_text(
        f"✅ **报告已提交！**\n\n"
        f"报告 ID：#{report_id}\n"
        f"教师：@{teacher_username}\n\n"
        f"⏳ 等待管理员审核，审核通过后将推送到报告频道。\n"
        f"您将收到审核结果通知。",
        parse_mode="Markdown",
    )
    await callback.answer("✅ 已提交")
    logger.info(f"用户 {user_id} 提交了关于 @{teacher_username} 的报告 #{report_id}")
