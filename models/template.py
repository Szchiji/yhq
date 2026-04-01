"""
报告模板数据模型
"""
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional


@dataclass
class TemplateField:
    """模板字段"""
    key: str
    label: str
    field_type: str = "text"  # text, number, select, multiline
    required: bool = True
    options: List[str] = field(default_factory=list)
    placeholder: str = ""
    min_length: int = 0
    max_length: int = 0


@dataclass
class Template:
    """报告模板模型"""
    id: Optional[int] = None
    name: str = ""
    description: str = ""
    header: str = ""
    footer: str = ""
    fields: List[TemplateField] = field(default_factory=list)
    predefined_tags: List[str] = field(default_factory=list)
    is_active: bool = True
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "header": self.header,
            "footer": self.footer,
            "fields": [
                {
                    "key": f.key,
                    "label": f.label,
                    "field_type": f.field_type,
                    "required": f.required,
                    "options": f.options,
                    "placeholder": f.placeholder,
                    "min_length": f.min_length,
                    "max_length": f.max_length,
                }
                for f in self.fields
            ],
            "predefined_tags": self.predefined_tags,
            "is_active": self.is_active,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
        }
