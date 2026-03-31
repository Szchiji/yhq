"""
handlers 包初始化
统一导出所有消息处理器模块
"""
from handlers import (
    menu,
    admin,
    template,
    report_form,
    quick_rate,
    search,
    mention,
    mention_report,
    broadcast,
    settings,
)

__all__ = [
    "menu",
    "admin",
    "template",
    "report_form",
    "quick_rate",
    "search",
    "mention",
    "mention_report",
    "broadcast",
    "settings",
]
