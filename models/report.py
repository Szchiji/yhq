"""
报告数据模型
"""
import json
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Dict, List, Optional


class ReportStatus(str, Enum):
    """报告状态枚举"""
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    DELETED = "deleted"


@dataclass
class Report:
    """报告模型"""
    id: Optional[int] = None
    teacher_username: str = ""
    submitter_id: int = 0
    submitter_name: str = ""
    form_data: Dict[str, Any] = field(default_factory=dict)
    tags: List[str] = field(default_factory=list)
    status: ReportStatus = ReportStatus.PENDING
    reviewer_id: Optional[int] = None
    reviewer_note: str = ""
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    screenshots: List[str] = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "teacher_username": self.teacher_username,
            "submitter_id": self.submitter_id,
            "submitter_name": self.submitter_name,
            "form_data": self.form_data,
            "tags": self.tags,
            "status": self.status.value,
            "reviewer_id": self.reviewer_id,
            "reviewer_note": self.reviewer_note,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
            "screenshots": self.screenshots,
        }

    @classmethod
    def from_dict(cls, data: dict) -> "Report":
        form_data = data.get("form_data", {})
        if isinstance(form_data, str):
            try:
                form_data = json.loads(form_data)
            except (json.JSONDecodeError, TypeError):
                form_data = {}
        tags = data.get("tags", [])
        if isinstance(tags, str):
            try:
                tags = json.loads(tags)
            except (json.JSONDecodeError, TypeError):
                tags = []
        return cls(
            id=data.get("id"),
            teacher_username=data.get("teacher_username", ""),
            submitter_id=data.get("submitter_id", 0),
            submitter_name=data.get("submitter_name", ""),
            form_data=form_data,
            tags=tags,
            status=ReportStatus(data.get("status", "pending")),
            reviewer_id=data.get("reviewer_id"),
            reviewer_note=data.get("reviewer_note", ""),
            screenshots=data.get("screenshots", []),
        )
