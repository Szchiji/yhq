"""
FSM 状态定义
"""
from aiogram.fsm.state import State, StatesGroup


class QuickRateStates(StatesGroup):
    """快速评价状态"""
    waiting_for_reason = State()      # 等待输入评价理由


class ReportFormStates(StatesGroup):
    """详细报告表单状态"""
    filling_field = State()           # 正在填写字段
    uploading_screenshots = State()   # 上传预约截图
    entering_tags = State()           # 输入标签
    previewing = State()              # 预览报告


class AdminStates(StatesGroup):
    """管理员操作状态"""
    reviewing_report = State()        # 审核报告
    searching_teacher = State()       # 搜索教师
    deleting_data = State()           # 删除数据
    managing_blacklist = State()      # 管理黑名单
    adding_channel = State()          # 添加频道
    editing_template = State()        # 编辑模板
    editing_template_header = State() # 编辑模板头部
    editing_template_footer = State() # 编辑模板尾部
    adding_predefined_tag = State()   # 添加预定义标签
    setting_field_name = State()      # 设置字段名称


class TemplateStates(StatesGroup):
    """模板管理状态"""
    editing_field_label = State()     # 编辑字段标签
    editing_header = State()          # 编辑头部
    editing_footer = State()          # 编辑尾部
    adding_tag = State()              # 添加标签
