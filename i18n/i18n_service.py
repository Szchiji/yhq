"""
国际化服务模块
支持多语言文本和本地化
"""

import logging
import os
from typing import Any, Dict, Optional

logger = logging.getLogger(__name__)


# ============================================================
# 内置翻译字典
# ============================================================

TRANSLATIONS: Dict[str, Dict[str, str]] = {
    "zh": {
        # 通用
        "welcome": "欢迎使用！",
        "error": "发生错误，请稍后重试。",
        "success": "操作成功！",
        "cancel": "已取消",
        "confirm": "确认",
        "back": "返回",
        "close": "关闭",
        "loading": "加载中...",
        "not_found": "未找到相关内容",
        # 认证
        "login_success": "登录成功！",
        "login_failed": "用户名或密码错误",
        "logout_success": "已退出登录",
        "token_expired": "登录已过期，请重新登录",
        "unauthorized": "无权限执行此操作",
        # 限流
        "rate_limit_exceeded": "操作过于频繁，请稍后重试",
        "account_locked": "账户已锁定，请在 {minutes} 分钟后重试",
        # 报告
        "report_submitted": "报告已提交，等待审核",
        "report_approved": "报告已通过审核",
        "report_rejected": "报告未通过审核",
        "report_pending": "报告待审核",
        # 管理
        "admin_only": "该功能仅管理员可用",
        "user_banned": "用户已被封禁",
        "user_unbanned": "用户封禁已解除",
    },
    "en": {
        # General
        "welcome": "Welcome!",
        "error": "An error occurred. Please try again later.",
        "success": "Operation successful!",
        "cancel": "Cancelled",
        "confirm": "Confirm",
        "back": "Back",
        "close": "Close",
        "loading": "Loading...",
        "not_found": "Not found",
        # Auth
        "login_success": "Login successful!",
        "login_failed": "Invalid username or password",
        "logout_success": "Logged out successfully",
        "token_expired": "Session expired, please log in again",
        "unauthorized": "You don't have permission for this action",
        # Rate limiting
        "rate_limit_exceeded": "Too many requests. Please try again later.",
        "account_locked": "Account locked. Please try again in {minutes} minutes.",
        # Reports
        "report_submitted": "Report submitted, awaiting review",
        "report_approved": "Report approved",
        "report_rejected": "Report rejected",
        "report_pending": "Report pending review",
        # Admin
        "admin_only": "This feature is for administrators only",
        "user_banned": "User has been banned",
        "user_unbanned": "User ban has been lifted",
    },
    "ja": {
        "welcome": "ようこそ！",
        "error": "エラーが発生しました。後でもう一度お試しください。",
        "success": "操作が成功しました！",
        "cancel": "キャンセル",
        "confirm": "確認",
        "back": "戻る",
        "not_found": "見つかりません",
        "report_submitted": "レポートが提出されました",
        "report_approved": "レポートが承認されました",
        "report_rejected": "レポートが却下されました",
        "admin_only": "この機能は管理者専用です",
    },
}

# 默认语言
DEFAULT_LANGUAGE = "zh"


class I18nService:
    """国际化服务"""

    def __init__(self, default_language: str = DEFAULT_LANGUAGE):
        self._default_language = default_language
        self._translations = dict(TRANSLATIONS)
        self._user_languages: Dict[int, str] = {}

        # 从环境变量读取默认语言
        env_lang = os.getenv("DEFAULT_LANGUAGE", default_language)
        if env_lang in self._translations:
            self._default_language = env_lang

        logger.info(f"国际化服务初始化，默认语言：{self._default_language}")

    def t(
        self,
        key: str,
        language: Optional[str] = None,
        **kwargs: Any,
    ) -> str:
        """
        翻译指定键。
        若未找到翻译，返回键名本身。
        支持模板变量：t("account_locked", minutes=15)
        """
        lang = language or self._default_language
        text = (
            self._translations.get(lang, {}).get(key)
            or self._translations.get(self._default_language, {}).get(key)
            or key
        )
        if kwargs:
            try:
                text = text.format(**kwargs)
            except (KeyError, ValueError):
                pass
        return text

    def get_user_language(self, user_id: int) -> str:
        """获取用户语言设置"""
        return self._user_languages.get(user_id, self._default_language)

    def set_user_language(self, user_id: int, language: str) -> bool:
        """设置用户语言"""
        if language not in self._translations:
            logger.warning(f"不支持的语言：{language}")
            return False
        self._user_languages[user_id] = language
        return True

    def tu(self, user_id: int, key: str, **kwargs: Any) -> str:
        """根据用户语言偏好翻译（t + user）"""
        lang = self.get_user_language(user_id)
        return self.t(key, language=lang, **kwargs)

    def add_translations(self, language: str, translations: Dict[str, str]):
        """动态添加翻译"""
        if language not in self._translations:
            self._translations[language] = {}
        self._translations[language].update(translations)

    def get_supported_languages(self) -> Dict[str, str]:
        """获取支持的语言列表"""
        names = {
            "zh": "中文",
            "en": "English",
            "ja": "日本語",
        }
        return {lang: names.get(lang, lang) for lang in self._translations}

    def get_language_display_name(self, language: str) -> str:
        """获取语言的显示名称"""
        names = {"zh": "中文", "en": "English", "ja": "日本語"}
        return names.get(language, language)


# 全局实例
i18n = I18nService()
# 便捷函数
t = i18n.t
