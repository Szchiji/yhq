"""
API 数据模式（Pydantic 可选）
提供请求/响应数据结构定义
"""
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional


@dataclass
class PaginatedResponse:
    """分页响应"""
    items: List[Any]
    total: int
    page: int
    per_page: int
    pages: int

    def to_dict(self) -> dict:
        return {
            "items": self.items,
            "total": self.total,
            "page": self.page,
            "per_page": self.per_page,
            "pages": self.pages,
        }


@dataclass
class APIResponse:
    """通用 API 响应"""
    success: bool
    message: str = ""
    data: Any = None
    error: Optional[str] = None

    def to_dict(self) -> dict:
        result = {
            "success": self.success,
            "message": self.message,
        }
        if self.data is not None:
            result["data"] = self.data
        if self.error:
            result["error"] = self.error
        return result


@dataclass
class LoginRequest:
    """登录请求"""
    user_id: int
    telegram_hash: str


@dataclass
class TokenResponse:
    """令牌响应"""
    access_token: str
    token_type: str = "bearer"
    expires_in: int = 3600

    def to_dict(self) -> dict:
        return {
            "access_token": self.access_token,
            "token_type": self.token_type,
            "expires_in": self.expires_in,
        }


@dataclass
class ReportCreateRequest:
    """创建报告请求"""
    teacher_username: str
    form_data: Dict[str, Any]
    tags: List[str] = field(default_factory=list)
    screenshots: List[str] = field(default_factory=list)


@dataclass
class ReportSearchRequest:
    """报告搜索请求"""
    query: str = ""
    tags: List[str] = field(default_factory=list)
    status: Optional[str] = None
    page: int = 1
    per_page: int = 10
