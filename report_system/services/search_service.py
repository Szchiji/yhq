"""
企业级搜索服务
"""
import logging
from typing import Any, Dict, List

logger = logging.getLogger(__name__)


class SearchServiceEnterprise:
    """企业级搜索服务"""

    def __init__(self):
        from services.search_service import SearchServiceWrapper
        self._base = SearchServiceWrapper()

    async def search_teachers(
        self,
        query: str,
        tags: List[str] = None,
        limit: int = 10,
        offset: int = 0,
    ) -> Dict[str, Any]:
        return await self._base.search_teachers(query, tags, limit, offset)

    async def search_reports(
        self, query: str, limit: int = 10, offset: int = 0
    ) -> Dict[str, Any]:
        return await self._base.search_reports(query, limit, offset)

    async def get_suggestions(self, partial: str, limit: int = 5) -> List[str]:
        return await self._base.get_suggestions(partial, limit)
