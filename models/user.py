"""
用户数据模型
"""
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Optional


class UserRole(str, Enum):
    """用户角色枚举"""
    USER = "user"
    ADMIN = "admin"
    MODERATOR = "moderator"


@dataclass
class User:
    """用户模型"""
    id: int
    username: Optional[str] = None
    first_name: str = ""
    last_name: str = ""
    role: UserRole = UserRole.USER
    is_banned: bool = False
    language_code: str = "zh"
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))

    @property
    def full_name(self) -> str:
        """获取完整姓名"""
        parts = [self.first_name, self.last_name]
        return " ".join(p for p in parts if p).strip() or str(self.id)

    @property
    def display_name(self) -> str:
        """获取显示名称"""
        if self.username:
            return f"@{self.username}"
        return self.full_name

    def is_admin(self) -> bool:
        return self.role == UserRole.ADMIN

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "username": self.username,
            "first_name": self.first_name,
            "last_name": self.last_name,
            "role": self.role.value,
            "is_banned": self.is_banned,
            "language_code": self.language_code,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
        }

    @classmethod
    def from_dict(cls, data: dict) -> "User":
        return cls(
            id=data["id"],
            username=data.get("username"),
            first_name=data.get("first_name", ""),
            last_name=data.get("last_name", ""),
            role=UserRole(data.get("role", "user")),
            is_banned=data.get("is_banned", False),
            language_code=data.get("language_code", "zh"),
        )
