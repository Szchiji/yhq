"""
搜索服务模块
支持本地全文搜索和可选的 Elasticsearch 集成
"""

import logging
import re
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)


class LocalSearchService:
    """基于数据库的本地全文搜索"""

    def __init__(self, db_getter=None):
        self._db_getter = db_getter

    async def _get_db(self):
        if self._db_getter:
            return await self._db_getter()
        from database import get_db
        return await get_db()

    async def search_reports(
        self,
        query: str,
        status: Optional[str] = None,
        limit: int = 20,
        offset: int = 0,
    ) -> Dict[str, Any]:
        """全文搜索报告（教师姓名或理由中包含关键词）"""
        try:
            db = await self._get_db()
            keywords = self._tokenize(query)
            if not keywords:
                return {"results": [], "total": 0, "query": query}

            conditions = []
            params: List[Any] = []

            keyword_conditions = []
            for kw in keywords:
                keyword_conditions.append(
                    "(teacher_name LIKE ? OR reason LIKE ?)"
                )
                params.extend([f"%{kw}%", f"%{kw}%"])
            conditions.append(f"({' OR '.join(keyword_conditions)})")

            if status:
                conditions.append("status = ?")
                params.append(status)

            where_clause = " AND ".join(conditions)

            count_cursor = await db.execute(
                f"SELECT COUNT(*) AS cnt FROM reports WHERE {where_clause}",
                params,
            )
            count_row = await count_cursor.fetchone()
            total = count_row["cnt"] if count_row else 0

            params.extend([limit, offset])
            cursor = await db.execute(
                f"""
                SELECT id, user_id, teacher_name, status, created_at
                FROM reports
                WHERE {where_clause}
                ORDER BY created_at DESC
                LIMIT ? OFFSET ?
                """,
                params,
            )
            rows = await cursor.fetchall()
            results = [
                {
                    "id": row["id"],
                    "user_id": row["user_id"],
                    "teacher_name": row["teacher_name"],
                    "status": row["status"],
                    "created_at": row["created_at"],
                }
                for row in rows
            ]
            return {"results": results, "total": total, "query": query}
        except Exception as e:
            logger.error(f"搜索报告失败：{e}")
            return {"results": [], "total": 0, "query": query, "error": str(e)}

    async def search_teachers(self, query: str, limit: int = 10) -> List[Dict[str, Any]]:
        """搜索教师（按姓名）"""
        try:
            db = await self._get_db()
            cursor = await db.execute(
                """
                SELECT teacher_name, COUNT(*) AS report_count
                FROM reports
                WHERE teacher_name LIKE ?
                GROUP BY teacher_name
                ORDER BY report_count DESC
                LIMIT ?
                """,
                (f"%{query}%", limit),
            )
            rows = await cursor.fetchall()
            return [
                {"teacher_name": row["teacher_name"], "report_count": row["report_count"]}
                for row in rows
            ]
        except Exception as e:
            logger.error(f"搜索教师失败：{e}")
            return []

    @staticmethod
    def _tokenize(query: str) -> List[str]:
        """简单分词：按空格和标点拆分，返回所有非空词元"""
        tokens = re.split(r"[\s,，。！？!?]+", query.strip())
        return [t for t in tokens if len(t) >= 1]


class ElasticsearchService:
    """Elasticsearch 集成（可选）"""

    def __init__(self, host: str = "http://localhost:9200", index: str = "reports"):
        self._host = host
        self._index = index
        self._client = None

    async def _get_client(self):
        if self._client is None:
            try:
                from elasticsearch import AsyncElasticsearch
                self._client = AsyncElasticsearch([self._host])
                logger.info(f"Elasticsearch 已连接：{self._host}")
            except ImportError:
                logger.error("未安装 elasticsearch 包，请运行: pip install elasticsearch")
                raise
        return self._client

    async def index_report(self, report_id: int, doc: dict) -> bool:
        """将报告索引到 Elasticsearch"""
        try:
            client = await self._get_client()
            await client.index(index=self._index, id=str(report_id), document=doc)
            return True
        except Exception as e:
            logger.error(f"Elasticsearch 索引失败 [{report_id}]：{e}")
            return False

    async def search(self, query: str, limit: int = 20) -> Dict[str, Any]:
        """在 Elasticsearch 中搜索"""
        try:
            client = await self._get_client()
            body = {
                "query": {
                    "multi_match": {
                        "query": query,
                        "fields": ["teacher_name^2", "reason"],
                        "fuzziness": "AUTO",
                    }
                },
                "size": limit,
            }
            resp = await client.search(index=self._index, body=body)
            hits = resp["hits"]["hits"]
            return {
                "results": [{"id": h["_id"], **h["_source"]} for h in hits],
                "total": resp["hits"]["total"]["value"],
                "query": query,
            }
        except Exception as e:
            logger.error(f"Elasticsearch 搜索失败：{e}")
            return {"results": [], "total": 0, "query": query, "error": str(e)}

    async def delete_report(self, report_id: int) -> bool:
        """从 Elasticsearch 删除报告"""
        try:
            client = await self._get_client()
            await client.delete(index=self._index, id=str(report_id), ignore=[404])
            return True
        except Exception as e:
            logger.error(f"Elasticsearch 删除失败 [{report_id}]：{e}")
            return False


class SearchService:
    """
    统一搜索服务
    优先使用 Elasticsearch（如配置），否则使用本地搜索
    """

    def __init__(self):
        import os
        es_host = os.getenv("ELASTICSEARCH_URL")
        if es_host:
            self._es = ElasticsearchService(host=es_host)
            self._use_es = True
            logger.info(f"使用 Elasticsearch：{es_host}")
        else:
            self._local = LocalSearchService()
            self._use_es = False
            logger.info("使用本地搜索")

    async def search_reports(
        self,
        query: str,
        status: Optional[str] = None,
        limit: int = 20,
        offset: int = 0,
    ) -> Dict[str, Any]:
        """搜索报告"""
        if self._use_es:
            return await self._es.search(query, limit=limit)
        return await self._local.search_reports(query, status=status, limit=limit, offset=offset)

    async def search_teachers(self, query: str, limit: int = 10) -> List[Dict[str, Any]]:
        """搜索教师"""
        if not self._use_es:
            return await self._local.search_teachers(query, limit=limit)
        result = await self._es.search(query, limit=limit)
        return result.get("results", [])

    async def index_report(self, report_id: int, doc: dict) -> bool:
        """索引报告（仅 ES 模式有效）"""
        if self._use_es:
            return await self._es.index_report(report_id, doc)
        return True


# 全局实例
search_service = SearchService()
