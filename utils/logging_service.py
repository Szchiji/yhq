"""
日志服务模块
支持审计日志、错误日志和性能监控
"""

import json
import logging
import os
import time
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)


class AuditLog:
    """审计日志记录（内存存储，生产环境应持久化到数据库）"""

    def __init__(self, max_records: int = 10000):
        self._records: List[dict] = []
        self._max_records = max_records

    def log(
        self,
        user_id: Optional[int],
        action: str,
        resource: str,
        resource_id: Optional[str] = None,
        details: Optional[dict] = None,
        success: bool = True,
        ip: Optional[str] = None,
    ) -> dict:
        """记录一条审计日志"""
        record = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "user_id": user_id,
            "action": action,
            "resource": resource,
            "resource_id": resource_id,
            "details": details or {},
            "success": success,
            "ip": ip,
        }
        self._records.append(record)
        # 超过上限时移除最旧记录
        if len(self._records) > self._max_records:
            self._records = self._records[-self._max_records :]
        logger.debug(f"审计：[{user_id}] {action} {resource} success={success}")
        return record

    def get_records(
        self,
        user_id: Optional[int] = None,
        action: Optional[str] = None,
        limit: int = 100,
    ) -> List[dict]:
        """查询审计日志"""
        records = self._records
        if user_id is not None:
            records = [r for r in records if r["user_id"] == user_id]
        if action is not None:
            records = [r for r in records if r["action"] == action]
        return records[-limit:]

    def clear(self):
        """清空审计日志"""
        self._records.clear()


class PerformanceMonitor:
    """性能监控"""

    def __init__(self):
        self._metrics: Dict[str, List[float]] = {}

    def record(self, operation: str, duration_ms: float):
        """记录操作耗时"""
        if operation not in self._metrics:
            self._metrics[operation] = []
        self._metrics[operation].append(duration_ms)
        # 每个操作最多保留最近 1000 条
        if len(self._metrics[operation]) > 1000:
            self._metrics[operation] = self._metrics[operation][-1000:]

    def get_stats(self, operation: str) -> Optional[Dict[str, float]]:
        """获取操作统计信息"""
        samples = self._metrics.get(operation)
        if not samples:
            return None
        return {
            "count": len(samples),
            "avg_ms": sum(samples) / len(samples),
            "min_ms": min(samples),
            "max_ms": max(samples),
            "p95_ms": sorted(samples)[int(len(samples) * 0.95)],
        }

    def get_all_stats(self) -> Dict[str, dict]:
        """获取所有操作的统计信息"""
        return {op: self.get_stats(op) for op in self._metrics}

    class Timer:
        """上下文管理器：计时器"""

        def __init__(self, monitor: "PerformanceMonitor", operation: str):
            self._monitor = monitor
            self._operation = operation
            self._start: Optional[float] = None

        def __enter__(self):
            self._start = time.perf_counter()
            return self

        def __exit__(self, *_):
            if self._start is not None:
                elapsed_ms = (time.perf_counter() - self._start) * 1000
                self._monitor.record(self._operation, elapsed_ms)

    def timer(self, operation: str) -> "PerformanceMonitor.Timer":
        """获取计时器上下文管理器"""
        return self.Timer(self, operation)


class ErrorTracker:
    """错误追踪器"""

    def __init__(self, max_errors: int = 1000):
        self._errors: List[dict] = []
        self._max_errors = max_errors

    def track(
        self,
        error: Exception,
        context: Optional[dict] = None,
        user_id: Optional[int] = None,
    ) -> dict:
        """记录一个错误"""
        record = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "error_type": type(error).__name__,
            "error_message": str(error),
            "context": context or {},
            "user_id": user_id,
        }
        self._errors.append(record)
        if len(self._errors) > self._max_errors:
            self._errors = self._errors[-self._max_errors :]
        logger.error(f"错误追踪：{type(error).__name__}: {error}")
        return record

    def get_recent_errors(self, limit: int = 50) -> List[dict]:
        """获取最近的错误记录"""
        return self._errors[-limit:]

    def get_error_count(self, error_type: Optional[str] = None) -> int:
        """获取错误数量"""
        if error_type:
            return sum(1 for e in self._errors if e["error_type"] == error_type)
        return len(self._errors)


class LoggingService:
    """统一日志服务"""

    def __init__(self):
        self.audit = AuditLog()
        self.performance = PerformanceMonitor()
        self.errors = ErrorTracker()

        # 配置文件日志（如果设置了路径）
        log_file = os.getenv("LOG_FILE")
        if log_file:
            self._setup_file_logging(log_file)

    def _setup_file_logging(self, log_file: str):
        """配置文件日志"""
        try:
            os.makedirs(os.path.dirname(log_file), exist_ok=True)
            file_handler = logging.FileHandler(log_file, encoding="utf-8")
            file_handler.setFormatter(
                logging.Formatter("%(asctime)s [%(levelname)s] %(name)s: %(message)s")
            )
            logging.getLogger().addHandler(file_handler)
            logger.info(f"文件日志已配置：{log_file}")
        except Exception as e:
            logger.warning(f"配置文件日志失败：{e}")

    def log_action(
        self,
        user_id: int,
        action: str,
        resource: str,
        success: bool = True,
        details: Optional[dict] = None,
    ):
        """记录用户操作"""
        self.audit.log(
            user_id=user_id,
            action=action,
            resource=resource,
            success=success,
            details=details,
        )

    def log_error(
        self,
        error: Exception,
        context: Optional[dict] = None,
        user_id: Optional[int] = None,
    ):
        """记录错误"""
        self.errors.track(error, context, user_id)

    def get_summary(self) -> dict:
        """获取日志摘要"""
        return {
            "audit_records": len(self.audit._records),
            "tracked_errors": self.errors.get_error_count(),
            "performance_ops": len(self.performance._metrics),
        }


# 全局实例
logging_service = LoggingService()
