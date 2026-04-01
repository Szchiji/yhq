"""
handlers 包初始化
统一导出所有消息处理器模块
"""
from handlers import (
    menu,
    admin,
    template,
    report_form,
    search,
    mention_report,
)

__all__ = [
    "menu",
    "admin",
    "template",
    "report_form",
    "search",
    "mention_report",
]
