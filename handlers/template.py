"""
报告模板管理处理模块
管理员可以自定义字段、标签、头部/尾部
"""
import logging

from aiogram import Router, F
from aiogram.types import Message, CallbackQuery, InlineKeyboardMarkup, InlineKeyboardButton
from aiogram.fsm.context import FSMContext
from aiogram.filters import StateFilter

from config import config
from database import (
    get_template_fields,
    update_template_field_label,
    get_template_config,
    set_template_config,
    get_predefined_tags,
    add_predefined_tag,
    delete_predefined_tag,
    get_tag_field_config,
    set_tag_field_config,
)
from states import TemplateStates

logger = logging.getLogger(__name__)
router = Router()


# ============================================================
# 模板主菜单
# ============================================================

@router.callback_query(F.data == "admin:template_menu")
async def template_menu(callback: CallbackQuery):
    """显示模板管理菜单"""
    if not config.is_admin(callback.from_user.id):
        await callback.answer("❌ 无权限", show_alert=True)
        return

    kb = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="📋 编辑字段", callback_data="template:edit_fields")],
        [InlineKeyboardButton(text="📝 编辑头部", callback_data="template:edit_header")],
        [InlineKeyboardButton(text="📝 编辑尾部", callback_data="template:edit_footer")],
        [InlineKeyboardButton(text="🏷 管理预定义标签", callback_data="template:manage_tags")],
        [InlineKeyboardButton(text="⚙️ 标签字段配置", callback_data="template:tag_config")],
        [InlineKeyboardButton(text="🔙 返回管理菜单", callback_data="admin_menu")],
    ])
    await callback.message.edit_text(
        "🛠 **模板管理**\n\n选择要管理的内容：",
        reply_markup=kb,
        parse_mode="Markdown",
    )
    await callback.answer()


# ============================================================
# 字段管理
# ============================================================

@router.callback_query(F.data == "template:edit_fields")
async def edit_fields(callback: CallbackQuery):
    """显示字段列表"""
    fields = await get_template_fields()
    buttons = []
    for field in fields:
        label = field["field_label"]
        key = field["field_key"]
        req = "✅" if field["is_required"] else "⬜"
        buttons.append([
            InlineKeyboardButton(
                text=f"{req} {label}",
                callback_data=f"template:edit_field:{key}"
            )
        ])
    buttons.append([InlineKeyboardButton(text="🔙 返回", callback_data="admin:template_menu")])

    await callback.message.edit_text(
        "📋 **字段管理**\n\n点击字段名称编辑：",
        reply_markup=InlineKeyboardMarkup(inline_keyboard=buttons),
        parse_mode="Markdown",
    )
    await callback.answer()


@router.callback_query(F.data.startswith("template:edit_field:"))
async def edit_single_field(callback: CallbackQuery, state: FSMContext):
    """编辑单个字段"""
    field_key = callback.data.split(":", 2)[2]
    await state.set_state(TemplateStates.editing_field_label)
    await state.update_data(editing_field_key=field_key)

    kb = InlineKeyboardMarkup(inline_keyboard=[[
        InlineKeyboardButton(text="❌ 取消", callback_data="template:cancel_edit")
    ]])
    await callback.message.answer(
        f"✏️ 请输入字段 **{field_key}** 的新显示名称：",
        reply_markup=kb,
        parse_mode="Markdown",
    )
    await callback.answer()


@router.message(TemplateStates.editing_field_label, F.text)
async def receive_field_label(message: Message, state: FSMContext):
    """接收新字段标签"""
    data = await state.get_data()
    field_key = data.get("editing_field_key")
    new_label = message.text.strip()

    if not new_label:
        await message.answer("⚠️ 字段名称不能为空")
        return

    await update_template_field_label(field_key, new_label)
    await state.clear()
    await message.answer(f"✅ 字段 **{field_key}** 的显示名称已更新为：**{new_label}**", parse_mode="Markdown")


# ============================================================
# 头部/尾部编辑
# ============================================================

@router.callback_query(F.data == "template:edit_header")
async def edit_header(callback: CallbackQuery, state: FSMContext):
    """编辑模板头部"""
    current = await get_template_config("header") or ""
    await state.set_state(TemplateStates.editing_header)

    kb = InlineKeyboardMarkup(inline_keyboard=[[
        InlineKeyboardButton(text="❌ 取消", callback_data="template:cancel_edit")
    ]])
    await callback.message.answer(
        f"📝 **编辑报告头部**\n\n当前内容：\n{current}\n\n请输入新的头部内容（支持 Markdown）：",
        reply_markup=kb,
        parse_mode="Markdown",
    )
    await callback.answer()


@router.message(TemplateStates.editing_header, F.text)
async def receive_header(message: Message, state: FSMContext):
    """接收头部内容"""
    await set_template_config("header", message.text)
    await state.clear()
    await message.answer("✅ 模板头部已更新")


@router.callback_query(F.data == "template:edit_footer")
async def edit_footer(callback: CallbackQuery, state: FSMContext):
    """编辑模板尾部"""
    current = await get_template_config("footer") or ""
    await state.set_state(TemplateStates.editing_footer)

    kb = InlineKeyboardMarkup(inline_keyboard=[[
        InlineKeyboardButton(text="❌ 取消", callback_data="template:cancel_edit")
    ]])
    await callback.message.answer(
        f"📝 **编辑报告尾部**\n\n当前内容：\n{current}\n\n请输入新的尾部内容（支持 Markdown）：",
        reply_markup=kb,
        parse_mode="Markdown",
    )
    await callback.answer()


@router.message(TemplateStates.editing_footer, F.text)
async def receive_footer(message: Message, state: FSMContext):
    """接收尾部内容"""
    await set_template_config("footer", message.text)
    await state.clear()
    await message.answer("✅ 模板尾部已更新")


# ============================================================
# 预定义标签管理
# ============================================================

@router.callback_query(F.data == "template:manage_tags")
async def manage_predefined_tags(callback: CallbackQuery):
    """管理预定义标签"""
    tags = await get_predefined_tags()

    buttons = []
    for tag in tags:
        buttons.append([
            InlineKeyboardButton(text=f"#{tag}", callback_data=f"template:noop"),
            InlineKeyboardButton(text="🗑 删除", callback_data=f"template:del_tag:{tag}"),
        ])

    buttons.append([InlineKeyboardButton(text="➕ 添加标签", callback_data="template:add_tag")])
    buttons.append([InlineKeyboardButton(text="🔙 返回", callback_data="admin:template_menu")])

    tags_display = "暂无预定义标签" if not tags else f"共 {len(tags)} 个标签"
    await callback.message.edit_text(
        f"🏷 **预定义标签管理**\n{tags_display}",
        reply_markup=InlineKeyboardMarkup(inline_keyboard=buttons),
        parse_mode="Markdown",
    )
    await callback.answer()


@router.callback_query(F.data == "template:add_tag")
async def start_add_tag(callback: CallbackQuery, state: FSMContext):
    """开始添加预定义标签"""
    await state.set_state(TemplateStates.adding_tag)
    kb = InlineKeyboardMarkup(inline_keyboard=[[
        InlineKeyboardButton(text="❌ 取消", callback_data="template:cancel_edit")
    ]])
    await callback.message.answer(
        "🏷 请输入要添加的标签名称（不含 #）：",
        reply_markup=kb,
    )
    await callback.answer()


@router.message(TemplateStates.adding_tag, F.text)
async def receive_new_tag(message: Message, state: FSMContext):
    """接收新标签"""
    tag = message.text.strip().lstrip("#")
    if not tag:
        await message.answer("⚠️ 标签名称不能为空")
        return

    success = await add_predefined_tag(tag)
    await state.clear()

    if success:
        await message.answer(f"✅ 标签 **#{tag}** 已添加", parse_mode="Markdown")
    else:
        await message.answer(f"⚠️ 标签 **#{tag}** 已存在", parse_mode="Markdown")


@router.callback_query(F.data.startswith("template:del_tag:"))
async def delete_tag(callback: CallbackQuery):
    """删除预定义标签"""
    tag = callback.data.split(":", 2)[2]
    success = await delete_predefined_tag(tag)
    if success:
        await callback.answer(f"✅ 标签 #{tag} 已删除")
        # 刷新列表
        await manage_predefined_tags(callback)
    else:
        await callback.answer("❌ 删除失败", show_alert=True)


# ============================================================
# 标签字段配置
# ============================================================

@router.callback_query(F.data == "template:tag_config")
async def tag_field_config(callback: CallbackQuery):
    """标签字段配置"""
    cfg = await get_tag_field_config()
    is_required = bool(cfg.get("is_required", 0))
    max_tags = cfg.get("max_tags", 5)

    status = "必填 ✅" if is_required else "可选 ⬜"
    toggle_text = "改为可选" if is_required else "改为必填"

    kb = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text=f"🔄 {toggle_text}", callback_data="template:toggle_tag_required")],
        [InlineKeyboardButton(text="🔙 返回", callback_data="admin:template_menu")],
    ])
    await callback.message.edit_text(
        f"⚙️ **标签字段配置**\n\n"
        f"• 是否必填：{status}\n"
        f"• 最多标签数：{max_tags}",
        reply_markup=kb,
        parse_mode="Markdown",
    )
    await callback.answer()


@router.callback_query(F.data == "template:toggle_tag_required")
async def toggle_tag_required(callback: CallbackQuery):
    """切换标签是否必填"""
    cfg = await get_tag_field_config()
    is_required = bool(cfg.get("is_required", 0))
    max_tags = cfg.get("max_tags", 5)

    await set_tag_field_config(not is_required, max_tags)
    new_status = "必填" if not is_required else "可选"
    await callback.answer(f"✅ 标签已设置为{new_status}")
    await tag_field_config(callback)


@router.callback_query(F.data == "template:cancel_edit")
async def cancel_template_edit(callback: CallbackQuery, state: FSMContext):
    """取消模板编辑"""
    await state.clear()
    await callback.message.edit_text("❌ 已取消编辑")
    await callback.answer()


@router.callback_query(F.data == "template:noop")
async def noop_callback(callback: CallbackQuery):
    """空操作（用于显示标签名称按钮）"""
    await callback.answer()
