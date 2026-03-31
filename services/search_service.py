"""
搜索服务
封装 utils.search_service 的搜索功能
"""
import logging
from typing import Any, Dict, List

logger = logging.getLogger(__name__)


class SearchServiceWrapper:
    """搜索业务服务"""

    def __init__(self):
        from utils.search_service import SearchService
        self._search = SearchService()

    async def search_teachers(
        self,
        query: str,
        tags: List[str] = None,
        limit: int = 10,
        offset: int = 0,
    ) -> Dict[str, Any]:
        results = await self._search.search_teachers(query, limit=limit)
        return {"results": results, "total": len(results), "query": query}

    async def search_reports(
        self,
        query: str,
        limit: int = 10,
        offset: int = 0,
    ) -> Dict[str, Any]:
        return await self._search.search_reports(query, limit=limit, offset=offset)

    async def get_suggestions(self, partial: str, limit: int = 5) -> List[str]:
        try:
            results = await self._search.search_teachers(partial, limit=limit)
            return [r.get("teacher_username", "") for r in results if r.get("teacher_username")]
        except Exception as e:
            logger.error(f"获取搜索建议失败：{e}")
            return []


# 全局实例
search_service = SearchServiceWrapper()
