"""
消息格式化工具
提供 Telegram 消息格式化辅助函数
"""
import html
import logging
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)


def escape_html(text: str) -> str:
    """转义 HTML 特殊字符"""
    if not text:
        return ""
    return html.escape(str(text))


def format_teacher_card(
    username: str,
    stats: Dict[str, Any],
    tags: List[str] = None,
) -> str:
    """格式化教师统计卡片"""
    safe_username = escape_html(username)
    recommend = stats.get("recommend_count", 0)
    not_recommend = stats.get("not_recommend_count", 0)
    total = recommend + not_recommend
    rate = round(recommend / total * 100) if total > 0 else 0

    lines = [
        f"👤 <b>@{safe_username}</b>",
        f"",
        f"📊 评价统计：",
        f"  ✅ 推荐：{recommend} 次",
        f"  ❌ 不推荐：{not_recommend} 次",
        f"  📈 好评率：{rate}%",
        f"  📝 总评价：{total} 次",
    ]
    if tags:
        tag_str = " ".join(f"#{escape_html(t)}" for t in tags[:10])
        lines.extend(["", f"🏷️ 标签：{tag_str}"])
    return "\n".join(lines)


def format_report_preview(
    form_data: Dict[str, Any],
    teacher_username: str,
    tags: List[str] = None,
    header: str = "",
    footer: str = "",
) -> str:
    """格式化报告预览"""
    lines = []
    if header:
        lines.append(escape_html(header))
        lines.append("")

    lines.append(f"📋 <b>报告预览</b>")
    lines.append(f"教师：@{escape_html(teacher_username)}")
    lines.append("")

    for key, value in form_data.items():
        if value:
            lines.append(f"<b>{escape_html(str(key))}：</b>{escape_html(str(value))}")

    if tags:
        tag_str = " ".join(f"#{escape_html(t)}" for t in tags)
        lines.extend(["", f"🏷️ {tag_str}"])

    if footer:
        lines.extend(["", escape_html(footer)])

    return "\n".join(lines)


def truncate_text(text: str, max_length: int = 200) -> str:
    """截断过长文本"""
    if len(text) <= max_length:
        return text
    return text[:max_length - 3] + "..."


def format_number(n: int) -> str:
    """格式化数字（添加千分位分隔符）"""
    return f"{n:,}"


def format_ranking_list(items: List[Dict], limit: int = 10) -> str:
    """格式化排行榜"""
    if not items:
        return "暂无数据"

    medals = ["🥇", "🥈", "🥉"]
    lines = ["🏆 <b>排行榜</b>", ""]

    for i, item in enumerate(items[:limit]):
        medal = medals[i] if i < 3 else f"{i + 1}."
        username = escape_html(item.get("teacher_username", "未知"))
        count = item.get("recommend_count", 0)
        lines.append(f"{medal} @{username} — {count} 次好评")

    return "\n".join(lines)
