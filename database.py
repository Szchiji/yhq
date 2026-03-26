"""
数据库操作模块
支持 SQLite / PostgreSQL / MySQL
"""
import logging
import os
import json
from datetime import datetime, timezone
from typing import Optional

from config import config

logger = logging.getLogger(__name__)

# ============================================================
# 数据库连接管理
# ============================================================

_db_conn = None


async def get_db():
    """获取数据库连接"""
    global _db_conn
    if _db_conn is None:
        await init_db()
    return _db_conn


async def init_db():
    """初始化数据库连接并创建表"""
    global _db_conn

    if config.DATABASE_TYPE == "sqlite":
        import aiosqlite
        os.makedirs(os.path.dirname(config.SQLITE_DB_PATH), exist_ok=True)
        _db_conn = await aiosqlite.connect(config.SQLITE_DB_PATH)
        _db_conn.row_factory = aiosqlite.Row
        await _create_tables_sqlite(_db_conn)
        logger.info(f"SQLite 数据库已连接：{config.SQLITE_DB_PATH}")

    elif config.DATABASE_TYPE == "postgresql":
        import asyncpg
        _db_conn = await asyncpg.connect(config.DATABASE_URL)
        await _create_tables_pg(_db_conn)
        logger.info("PostgreSQL 数据库已连接")

    elif config.DATABASE_TYPE == "mysql":
        import aiomysql
        _db_conn = await aiomysql.connect(
            host=config.MYSQL_HOST,
            port=config.MYSQL_PORT,
            user=config.MYSQL_USER,
            password=config.MYSQL_PASSWORD,
            db=config.MYSQL_DATABASE,
            charset="utf8mb4",
        )
        await _create_tables_mysql(_db_conn)
        logger.info("MySQL 数据库已连接")

    else:
        raise ValueError(f"不支持的数据库类型：{config.DATABASE_TYPE}")


async def close_db():
    """关闭数据库连接"""
    global _db_conn
    if _db_conn:
        await _db_conn.close()
        _db_conn = None
        logger.info("数据库连接已关闭")


# ============================================================
# 建表语句
# ============================================================

async def _create_tables_sqlite(conn):
    """创建 SQLite 数据表"""
    await conn.executescript("""
        -- 快速评价记录
        CREATE TABLE IF NOT EXISTS quick_evaluations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            teacher_username TEXT NOT NULL,
            evaluator_id INTEGER NOT NULL,
            evaluator_name TEXT,
            is_recommended INTEGER NOT NULL DEFAULT 0,
            reason TEXT,
            created_at TEXT DEFAULT (datetime('now'))
        );

        -- 待审核报告
        CREATE TABLE IF NOT EXISTS pending_reports (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            teacher_username TEXT NOT NULL,
            submitter_id INTEGER NOT NULL,
            submitter_name TEXT,
            form_data TEXT NOT NULL,
            tags TEXT DEFAULT '[]',
            status TEXT DEFAULT 'pending',
            created_at TEXT DEFAULT (datetime('now'))
        );

        -- 已发布报告
        CREATE TABLE IF NOT EXISTS published_reports (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            teacher_username TEXT NOT NULL,
            submitter_id INTEGER NOT NULL,
            submitter_name TEXT,
            form_data TEXT NOT NULL,
            tags TEXT DEFAULT '[]',
            message_ids TEXT DEFAULT '[]',
            published_at TEXT DEFAULT (datetime('now'))
        );

        -- 预约截图
        CREATE TABLE IF NOT EXISTS report_screenshots (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            report_id INTEGER NOT NULL,
            report_type TEXT NOT NULL,
            file_id TEXT NOT NULL,
            created_at TEXT DEFAULT (datetime('now'))
        );

        -- 标签字段配置
        CREATE TABLE IF NOT EXISTS tag_field_config (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            is_required INTEGER DEFAULT 0,
            max_tags INTEGER DEFAULT 5,
            updated_at TEXT DEFAULT (datetime('now'))
        );

        -- 预定义标签
        CREATE TABLE IF NOT EXISTS predefined_tags (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            tag TEXT NOT NULL UNIQUE,
            created_at TEXT DEFAULT (datetime('now'))
        );

        -- 强制订阅频道
        CREATE TABLE IF NOT EXISTS channels (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            channel_id INTEGER NOT NULL UNIQUE,
            channel_name TEXT,
            created_at TEXT DEFAULT (datetime('now'))
        );

        -- 报告推送频道
        CREATE TABLE IF NOT EXISTS report_channels (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            channel_id INTEGER NOT NULL UNIQUE,
            channel_name TEXT,
            created_at TEXT DEFAULT (datetime('now'))
        );

        -- 报告模板
        CREATE TABLE IF NOT EXISTS report_templates (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            field_key TEXT NOT NULL UNIQUE,
            field_label TEXT NOT NULL,
            field_order INTEGER DEFAULT 0,
            is_required INTEGER DEFAULT 1,
            is_active INTEGER DEFAULT 1,
            updated_at TEXT DEFAULT (datetime('now'))
        );

        -- 模板头部/尾部
        CREATE TABLE IF NOT EXISTS template_config (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            config_key TEXT NOT NULL UNIQUE,
            config_value TEXT,
            updated_at TEXT DEFAULT (datetime('now'))
        );

        -- 用户黑名单
        CREATE TABLE IF NOT EXISTS blacklist (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL UNIQUE,
            user_name TEXT,
            reason TEXT,
            created_at TEXT DEFAULT (datetime('now'))
        );

        -- 广播记录
        CREATE TABLE IF NOT EXISTS broadcasts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            sender_id INTEGER NOT NULL,
            content_type TEXT NOT NULL DEFAULT 'text',
            text TEXT,
            file_id TEXT,
            sent_count INTEGER DEFAULT 0,
            failed_count INTEGER DEFAULT 0,
            created_at TEXT DEFAULT (datetime('now'))
        );

        -- 机器人自定义设置
        CREATE TABLE IF NOT EXISTS bot_settings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            setting_key TEXT NOT NULL UNIQUE,
            setting_value TEXT,
            updated_at TEXT DEFAULT (datetime('now'))
        );

        -- 用户记录（用于广播）
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL UNIQUE,
            user_name TEXT,
            full_name TEXT,
            last_seen TEXT DEFAULT (datetime('now'))
        );
    """)
    await conn.commit()

    # 初始化默认模板字段
    await _init_default_template(conn)


async def _create_tables_pg(conn):
    """创建 PostgreSQL 数据表"""
    await conn.execute("""
        CREATE TABLE IF NOT EXISTS quick_evaluations (
            id SERIAL PRIMARY KEY,
            teacher_username TEXT NOT NULL,
            evaluator_id BIGINT NOT NULL,
            evaluator_name TEXT,
            is_recommended BOOLEAN DEFAULT FALSE,
            reason TEXT,
            created_at TIMESTAMP DEFAULT NOW()
        );
        CREATE TABLE IF NOT EXISTS pending_reports (
            id SERIAL PRIMARY KEY,
            teacher_username TEXT NOT NULL,
            submitter_id BIGINT NOT NULL,
            submitter_name TEXT,
            form_data JSONB NOT NULL,
            tags JSONB DEFAULT '[]',
            status TEXT DEFAULT 'pending',
            created_at TIMESTAMP DEFAULT NOW()
        );
        CREATE TABLE IF NOT EXISTS published_reports (
            id SERIAL PRIMARY KEY,
            teacher_username TEXT NOT NULL,
            submitter_id BIGINT NOT NULL,
            submitter_name TEXT,
            form_data JSONB NOT NULL,
            tags JSONB DEFAULT '[]',
            message_ids JSONB DEFAULT '[]',
            published_at TIMESTAMP DEFAULT NOW()
        );
        CREATE TABLE IF NOT EXISTS report_screenshots (
            id SERIAL PRIMARY KEY,
            report_id INT NOT NULL,
            report_type TEXT NOT NULL,
            file_id TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT NOW()
        );
        CREATE TABLE IF NOT EXISTS tag_field_config (
            id SERIAL PRIMARY KEY,
            is_required BOOLEAN DEFAULT FALSE,
            max_tags INT DEFAULT 5,
            updated_at TIMESTAMP DEFAULT NOW()
        );
        CREATE TABLE IF NOT EXISTS predefined_tags (
            id SERIAL PRIMARY KEY,
            tag TEXT NOT NULL UNIQUE,
            created_at TIMESTAMP DEFAULT NOW()
        );
        CREATE TABLE IF NOT EXISTS channels (
            id SERIAL PRIMARY KEY,
            channel_id BIGINT NOT NULL UNIQUE,
            channel_name TEXT,
            created_at TIMESTAMP DEFAULT NOW()
        );
        CREATE TABLE IF NOT EXISTS report_channels (
            id SERIAL PRIMARY KEY,
            channel_id BIGINT NOT NULL UNIQUE,
            channel_name TEXT,
            created_at TIMESTAMP DEFAULT NOW()
        );
        CREATE TABLE IF NOT EXISTS report_templates (
            id SERIAL PRIMARY KEY,
            field_key TEXT NOT NULL UNIQUE,
            field_label TEXT NOT NULL,
            field_order INT DEFAULT 0,
            is_required BOOLEAN DEFAULT TRUE,
            is_active BOOLEAN DEFAULT TRUE,
            updated_at TIMESTAMP DEFAULT NOW()
        );
        CREATE TABLE IF NOT EXISTS template_config (
            id SERIAL PRIMARY KEY,
            config_key TEXT NOT NULL UNIQUE,
            config_value TEXT,
            updated_at TIMESTAMP DEFAULT NOW()
        );
        CREATE TABLE IF NOT EXISTS blacklist (
            id SERIAL PRIMARY KEY,
            user_id BIGINT NOT NULL UNIQUE,
            user_name TEXT,
            reason TEXT,
            created_at TIMESTAMP DEFAULT NOW()
        );
        CREATE TABLE IF NOT EXISTS broadcasts (
            id SERIAL PRIMARY KEY,
            sender_id BIGINT NOT NULL,
            content_type TEXT NOT NULL DEFAULT 'text',
            text TEXT,
            file_id TEXT,
            sent_count INT DEFAULT 0,
            failed_count INT DEFAULT 0,
            created_at TIMESTAMP DEFAULT NOW()
        );
        CREATE TABLE IF NOT EXISTS bot_settings (
            id SERIAL PRIMARY KEY,
            setting_key TEXT NOT NULL UNIQUE,
            setting_value TEXT,
            updated_at TIMESTAMP DEFAULT NOW()
        );
        CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            user_id BIGINT NOT NULL UNIQUE,
            user_name TEXT,
            full_name TEXT,
            last_seen TIMESTAMP DEFAULT NOW()
        );
    """)


async def _create_tables_mysql(conn):
    """创建 MySQL 数据表"""
    async with conn.cursor() as cur:
        tables = [
            """CREATE TABLE IF NOT EXISTS quick_evaluations (
                id INT AUTO_INCREMENT PRIMARY KEY,
                teacher_username VARCHAR(255) NOT NULL,
                evaluator_id BIGINT NOT NULL,
                evaluator_name VARCHAR(255),
                is_recommended TINYINT DEFAULT 0,
                reason TEXT,
                created_at DATETIME DEFAULT NOW()
            ) CHARACTER SET utf8mb4""",
            """CREATE TABLE IF NOT EXISTS pending_reports (
                id INT AUTO_INCREMENT PRIMARY KEY,
                teacher_username VARCHAR(255) NOT NULL,
                submitter_id BIGINT NOT NULL,
                submitter_name VARCHAR(255),
                form_data JSON NOT NULL,
                tags JSON,
                status VARCHAR(50) DEFAULT 'pending',
                created_at DATETIME DEFAULT NOW()
            ) CHARACTER SET utf8mb4""",
            """CREATE TABLE IF NOT EXISTS published_reports (
                id INT AUTO_INCREMENT PRIMARY KEY,
                teacher_username VARCHAR(255) NOT NULL,
                submitter_id BIGINT NOT NULL,
                submitter_name VARCHAR(255),
                form_data JSON NOT NULL,
                tags JSON,
                message_ids JSON,
                published_at DATETIME DEFAULT NOW()
            ) CHARACTER SET utf8mb4""",
            """CREATE TABLE IF NOT EXISTS report_screenshots (
                id INT AUTO_INCREMENT PRIMARY KEY,
                report_id INT NOT NULL,
                report_type VARCHAR(50) NOT NULL,
                file_id TEXT NOT NULL,
                created_at DATETIME DEFAULT NOW()
            ) CHARACTER SET utf8mb4""",
            """CREATE TABLE IF NOT EXISTS predefined_tags (
                id INT AUTO_INCREMENT PRIMARY KEY,
                tag VARCHAR(100) NOT NULL UNIQUE,
                created_at DATETIME DEFAULT NOW()
            ) CHARACTER SET utf8mb4""",
            """CREATE TABLE IF NOT EXISTS channels (
                id INT AUTO_INCREMENT PRIMARY KEY,
                channel_id BIGINT NOT NULL UNIQUE,
                channel_name VARCHAR(255),
                created_at DATETIME DEFAULT NOW()
            ) CHARACTER SET utf8mb4""",
            """CREATE TABLE IF NOT EXISTS report_channels (
                id INT AUTO_INCREMENT PRIMARY KEY,
                channel_id BIGINT NOT NULL UNIQUE,
                channel_name VARCHAR(255),
                created_at DATETIME DEFAULT NOW()
            ) CHARACTER SET utf8mb4""",
            """CREATE TABLE IF NOT EXISTS report_templates (
                id INT AUTO_INCREMENT PRIMARY KEY,
                field_key VARCHAR(100) NOT NULL UNIQUE,
                field_label VARCHAR(255) NOT NULL,
                field_order INT DEFAULT 0,
                is_required TINYINT DEFAULT 1,
                is_active TINYINT DEFAULT 1,
                updated_at DATETIME DEFAULT NOW()
            ) CHARACTER SET utf8mb4""",
            """CREATE TABLE IF NOT EXISTS template_config (
                id INT AUTO_INCREMENT PRIMARY KEY,
                config_key VARCHAR(100) NOT NULL UNIQUE,
                config_value TEXT,
                updated_at DATETIME DEFAULT NOW()
            ) CHARACTER SET utf8mb4""",
            """CREATE TABLE IF NOT EXISTS blacklist (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id BIGINT NOT NULL UNIQUE,
                user_name VARCHAR(255),
                reason TEXT,
                created_at DATETIME DEFAULT NOW()
            ) CHARACTER SET utf8mb4""",
            """CREATE TABLE IF NOT EXISTS broadcasts (
                id INT AUTO_INCREMENT PRIMARY KEY,
                sender_id BIGINT NOT NULL,
                content_type VARCHAR(50) NOT NULL DEFAULT 'text',
                text TEXT,
                file_id TEXT,
                sent_count INT DEFAULT 0,
                failed_count INT DEFAULT 0,
                created_at DATETIME DEFAULT NOW()
            ) CHARACTER SET utf8mb4""",
            """CREATE TABLE IF NOT EXISTS bot_settings (
                id INT AUTO_INCREMENT PRIMARY KEY,
                setting_key VARCHAR(100) NOT NULL UNIQUE,
                setting_value TEXT,
                updated_at DATETIME DEFAULT NOW()
            ) CHARACTER SET utf8mb4""",
            """CREATE TABLE IF NOT EXISTS users (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id BIGINT NOT NULL UNIQUE,
                user_name VARCHAR(255),
                full_name VARCHAR(255),
                last_seen DATETIME DEFAULT NOW()
            ) CHARACTER SET utf8mb4""",
        ]
        for sql in tables:
            await cur.execute(sql)
        await conn.commit()


async def _init_default_template(conn):
    """初始化默认模板字段（SQLite）"""
    fields = [
        ("teacher_name", "教师姓名", 1, 1),
        ("subject", "教授科目", 2, 1),
        ("location", "教学地点", 3, 1),
        ("teaching_style", "教学风格", 4, 1),
        ("price", "课时价格", 5, 0),
        ("overall_rating", "综合评分", 6, 1),
        ("comment", "详细评价", 7, 1),
    ]
    for key, label, order, required in fields:
        await conn.execute(
            """INSERT OR IGNORE INTO report_templates
               (field_key, field_label, field_order, is_required) VALUES (?,?,?,?)""",
            (key, label, order, required),
        )

    # 默认模板配置
    defaults = [
        ("header", "📋 **教师评价报告**\n"),
        ("footer", "\n💡 _本报告由用户自主提交，仅供参考_"),
    ]
    for key, value in defaults:
        await conn.execute(
            "INSERT OR IGNORE INTO template_config (config_key, config_value) VALUES (?,?)",
            (key, value),
        )
    await conn.commit()


# ============================================================
# 快速评价操作
# ============================================================

async def save_quick_evaluation(
    teacher_username: str,
    evaluator_id: int,
    evaluator_name: str,
    is_recommended: bool,
    reason: str,
) -> int:
    """保存快速评价"""
    db = await get_db()
    cursor = await db.execute(
        """INSERT INTO quick_evaluations
           (teacher_username, evaluator_id, evaluator_name, is_recommended, reason)
           VALUES (?, ?, ?, ?, ?)""",
        (teacher_username, evaluator_id, evaluator_name, int(is_recommended), reason),
    )
    await db.commit()
    return cursor.lastrowid


async def get_quick_evaluation_stats(teacher_username: str) -> dict:
    """获取教师快速评价统计（含推荐数、不推荐数和平均评分）"""
    db = await get_db()

    cursor = await db.execute(
        """SELECT
               COUNT(*) as total,
               SUM(CASE WHEN is_recommended = 1 THEN 1 ELSE 0 END) as recommended,
               SUM(CASE WHEN is_recommended = 0 THEN 1 ELSE 0 END) as not_recommended
           FROM quick_evaluations
           WHERE teacher_username = ?""",
        (teacher_username,),
    )
    row = await cursor.fetchone()

    total = row["total"] or 0
    recommended = row["recommended"] or 0
    not_recommended = row["not_recommended"] or 0
    avg_score = ((recommended / total) * 10) if total > 0 else 0.0

    return {
        "recommend_count": recommended,
        "not_recommend_count": not_recommended,
        "avg_score": avg_score,
        "total": total,
    }


async def get_user_rating(teacher_username: str) -> float:
    """获取教师的平均评分（0-10）"""
    stats = await get_quick_evaluation_stats(teacher_username)
    return stats["avg_score"]


async def get_teacher_stats(teacher_username: str) -> dict:
    """获取教师评价统计"""
    db = await get_db()

    cursor = await db.execute(
        """SELECT
               COUNT(*) as total,
               SUM(CASE WHEN is_recommended = 1 THEN 1 ELSE 0 END) as recommended,
               SUM(CASE WHEN is_recommended = 0 THEN 1 ELSE 0 END) as not_recommended
           FROM quick_evaluations
           WHERE teacher_username = ?""",
        (teacher_username,),
    )
    row = await cursor.fetchone()

    return {
        "total": row["total"] or 0,
        "recommended": row["recommended"] or 0,
        "not_recommended": row["not_recommended"] or 0,
    }


async def get_recent_evaluations(teacher_username: str, limit: int = 5) -> list:
    """获取最近评价列表"""
    db = await get_db()
    cursor = await db.execute(
        """SELECT evaluator_name, is_recommended, reason, created_at
           FROM quick_evaluations
           WHERE teacher_username = ?
           ORDER BY created_at DESC LIMIT ?""",
        (teacher_username, limit),
    )
    rows = await cursor.fetchall()
    return [dict(r) for r in rows]


async def get_ranking(limit: int = 10) -> list:
    """获取推荐排行榜"""
    db = await get_db()
    cursor = await db.execute(
        """SELECT
               teacher_username,
               COUNT(*) as total,
               SUM(CASE WHEN is_recommended = 1 THEN 1 ELSE 0 END) as recommended
           FROM quick_evaluations
           GROUP BY teacher_username
           ORDER BY recommended DESC, total DESC
           LIMIT ?""",
        (limit,),
    )
    rows = await cursor.fetchall()
    return [dict(r) for r in rows]


async def delete_teacher_evaluations(teacher_username: str) -> int:
    """删除教师的所有快速评价"""
    db = await get_db()
    cursor = await db.execute(
        "DELETE FROM quick_evaluations WHERE teacher_username = ?",
        (teacher_username,),
    )
    await db.commit()
    return cursor.rowcount


async def has_user_evaluated(teacher_username: str, evaluator_id: int) -> bool:
    """检查用户是否已评价过该教师"""
    db = await get_db()
    cursor = await db.execute(
        """SELECT id FROM quick_evaluations
           WHERE teacher_username = ? AND evaluator_id = ?""",
        (teacher_username, evaluator_id),
    )
    row = await cursor.fetchone()
    return row is not None


# ============================================================
# 报告操作
# ============================================================

async def save_pending_report(
    teacher_username: str,
    submitter_id: int,
    submitter_name: str,
    form_data: dict,
    tags: list,
) -> int:
    """保存待审核报告"""
    db = await get_db()
    cursor = await db.execute(
        """INSERT INTO pending_reports
           (teacher_username, submitter_id, submitter_name, form_data, tags)
           VALUES (?, ?, ?, ?, ?)""",
        (
            teacher_username,
            submitter_id,
            submitter_name,
            json.dumps(form_data, ensure_ascii=False),
            json.dumps(tags, ensure_ascii=False),
        ),
    )
    await db.commit()
    return cursor.lastrowid


async def save_report_screenshot(
    report_id: int,
    report_type: str,
    file_id: str,
) -> int:
    """保存报告截图"""
    db = await get_db()
    cursor = await db.execute(
        """INSERT INTO report_screenshots (report_id, report_type, file_id)
           VALUES (?, ?, ?)""",
        (report_id, report_type, file_id),
    )
    await db.commit()
    return cursor.lastrowid


async def get_pending_reports(limit: int = 20) -> list:
    """获取待审核报告列表"""
    db = await get_db()
    cursor = await db.execute(
        """SELECT * FROM pending_reports
           WHERE status = 'pending'
           ORDER BY created_at DESC LIMIT ?""",
        (limit,),
    )
    rows = await cursor.fetchall()
    result = []
    for r in rows:
        d = dict(r)
        d["form_data"] = json.loads(d["form_data"])
        d["tags"] = json.loads(d["tags"])
        result.append(d)
    return result


async def get_pending_report_by_id(report_id: int) -> Optional[dict]:
    """根据 ID 获取待审核报告"""
    db = await get_db()
    cursor = await db.execute(
        "SELECT * FROM pending_reports WHERE id = ?",
        (report_id,),
    )
    row = await cursor.fetchone()
    if not row:
        return None
    d = dict(row)
    d["form_data"] = json.loads(d["form_data"])
    d["tags"] = json.loads(d["tags"])
    return d


async def get_report_screenshots(report_id: int, report_type: str) -> list:
    """获取报告的截图列表"""
    db = await get_db()
    cursor = await db.execute(
        """SELECT file_id FROM report_screenshots
           WHERE report_id = ? AND report_type = ?""",
        (report_id, report_type),
    )
    rows = await cursor.fetchall()
    return [r["file_id"] for r in rows]


async def approve_report(report_id: int) -> Optional[dict]:
    """通过审核报告，移至已发布"""
    db = await get_db()
    report = await get_pending_report_by_id(report_id)
    if not report:
        return None

    # 插入已发布表
    cursor = await db.execute(
        """INSERT INTO published_reports
           (teacher_username, submitter_id, submitter_name, form_data, tags)
           VALUES (?, ?, ?, ?, ?)""",
        (
            report["teacher_username"],
            report["submitter_id"],
            report["submitter_name"],
            json.dumps(report["form_data"], ensure_ascii=False),
            json.dumps(report["tags"], ensure_ascii=False),
        ),
    )
    published_id = cursor.lastrowid

    # 迁移截图
    screenshots = await get_report_screenshots(report_id, "pending")
    for file_id in screenshots:
        await db.execute(
            """INSERT INTO report_screenshots (report_id, report_type, file_id)
               VALUES (?, 'published', ?)""",
            (published_id, file_id),
        )

    # 更新状态
    await db.execute(
        "UPDATE pending_reports SET status = 'approved' WHERE id = ?",
        (report_id,),
    )
    await db.commit()

    report["published_id"] = published_id
    return report


async def reject_report(report_id: int) -> bool:
    """驳回报告"""
    db = await get_db()
    cursor = await db.execute(
        "UPDATE pending_reports SET status = 'rejected' WHERE id = ?",
        (report_id,),
    )
    await db.commit()
    return cursor.rowcount > 0


async def get_published_reports_by_tag(tag: str, limit: int = 10) -> list:
    """根据标签搜索已发布报告"""
    db = await get_db()
    cursor = await db.execute(
        """SELECT * FROM published_reports
           WHERE tags LIKE ?
           ORDER BY published_at DESC LIMIT ?""",
        (f'%"{tag}"%', limit),
    )
    rows = await cursor.fetchall()
    result = []
    for r in rows:
        d = dict(r)
        d["form_data"] = json.loads(d["form_data"])
        d["tags"] = json.loads(d["tags"])
        result.append(d)
    return result


async def search_published_reports_by_tags(tags: list, limit: int = 10) -> list:
    """根据多个标签搜索已发布报告（AND 逻辑）"""
    all_results = {}
    for tag in tags:
        reports = await get_published_reports_by_tag(tag, limit * 2)
        for r in reports:
            all_results[r["id"]] = r

    # 过滤出包含所有标签的报告
    filtered = []
    for report in all_results.values():
        report_tags = report["tags"]
        if all(t in report_tags for t in tags):
            filtered.append(report)
        if len(filtered) >= limit:
            break

    return filtered[:limit]


async def update_published_report_message_ids(report_id: int, message_ids: list):
    """更新已发布报告的消息 ID"""
    db = await get_db()
    await db.execute(
        "UPDATE published_reports SET message_ids = ? WHERE id = ?",
        (json.dumps(message_ids), report_id),
    )
    await db.commit()


# ============================================================
# 模板操作
# ============================================================

async def get_template_fields() -> list:
    """获取模板字段列表（按顺序）"""
    db = await get_db()
    cursor = await db.execute(
        """SELECT * FROM report_templates
           WHERE is_active = 1
           ORDER BY field_order ASC""",
    )
    rows = await cursor.fetchall()
    return [dict(r) for r in rows]


async def update_template_field_label(field_key: str, label: str):
    """更新模板字段标签"""
    db = await get_db()
    now = datetime.now(timezone.utc).isoformat()
    await db.execute(
        "UPDATE report_templates SET field_label = ?, updated_at = ? WHERE field_key = ?",
        (label, now, field_key),
    )
    await db.commit()


async def update_template_field_order(field_key: str, order: int):
    """更新字段顺序"""
    db = await get_db()
    await db.execute(
        "UPDATE report_templates SET field_order = ? WHERE field_key = ?",
        (order, field_key),
    )
    await db.commit()


async def get_template_config(key: str) -> Optional[str]:
    """获取模板配置值"""
    db = await get_db()
    cursor = await db.execute(
        "SELECT config_value FROM template_config WHERE config_key = ?",
        (key,),
    )
    row = await cursor.fetchone()
    return row["config_value"] if row else None


async def set_template_config(key: str, value: str):
    """设置模板配置值"""
    db = await get_db()
    now = datetime.now(timezone.utc).isoformat()
    # Check if key exists, then update or insert
    cursor = await db.execute(
        "SELECT id FROM template_config WHERE config_key = ?", (key,)
    )
    row = await cursor.fetchone()
    if row:
        await db.execute(
            "UPDATE template_config SET config_value = ?, updated_at = ? WHERE config_key = ?",
            (value, now, key),
        )
    else:
        await db.execute(
            "INSERT INTO template_config (config_key, config_value, updated_at) VALUES (?, ?, ?)",
            (key, value, now),
        )
    await db.commit()


# ============================================================
# 标签操作
# ============================================================

async def get_predefined_tags() -> list:
    """获取预定义标签列表"""
    db = await get_db()
    cursor = await db.execute(
        "SELECT tag FROM predefined_tags ORDER BY tag",
    )
    rows = await cursor.fetchall()
    return [r["tag"] for r in rows]


async def add_predefined_tag(tag: str) -> bool:
    """添加预定义标签"""
    db = await get_db()
    try:
        cursor = await db.execute(
            "SELECT id FROM predefined_tags WHERE tag = ?", (tag,)
        )
        if await cursor.fetchone():
            return False  # 标签已存在
        await db.execute(
            "INSERT INTO predefined_tags (tag) VALUES (?)",
            (tag,),
        )
        await db.commit()
        return True
    except Exception:
        return False


async def delete_predefined_tag(tag: str) -> bool:
    """删除预定义标签"""
    db = await get_db()
    cursor = await db.execute(
        "DELETE FROM predefined_tags WHERE tag = ?",
        (tag,),
    )
    await db.commit()
    return cursor.rowcount > 0


async def get_tag_field_config() -> dict:
    """获取标签字段配置"""
    db = await get_db()
    cursor = await db.execute(
        "SELECT * FROM tag_field_config ORDER BY id DESC LIMIT 1",
    )
    row = await cursor.fetchone()
    if row:
        return dict(row)
    return {"is_required": 0, "max_tags": 5}


async def set_tag_field_config(is_required: bool, max_tags: int):
    """设置标签字段配置"""
    db = await get_db()
    await db.execute("DELETE FROM tag_field_config")
    await db.execute(
        "INSERT INTO tag_field_config (is_required, max_tags) VALUES (?, ?)",
        (int(is_required), max_tags),
    )
    await db.commit()


# ============================================================
# 频道操作
# ============================================================

async def get_required_channels() -> list:
    """获取强制订阅频道列表"""
    db = await get_db()
    cursor = await db.execute(
        "SELECT channel_id, channel_name FROM channels ORDER BY id",
    )
    rows = await cursor.fetchall()
    return [dict(r) for r in rows]


async def add_required_channel(channel_id: int, channel_name: str = ""):
    """添加强制订阅频道"""
    db = await get_db()
    cursor = await db.execute(
        "SELECT id FROM channels WHERE channel_id = ?", (channel_id,)
    )
    if not await cursor.fetchone():
        await db.execute(
            "INSERT INTO channels (channel_id, channel_name) VALUES (?, ?)",
            (channel_id, channel_name),
        )
        await db.commit()


async def remove_required_channel(channel_id: int) -> bool:
    """删除强制订阅频道"""
    db = await get_db()
    cursor = await db.execute(
        "DELETE FROM channels WHERE channel_id = ?",
        (channel_id,),
    )
    await db.commit()
    return cursor.rowcount > 0


async def get_report_channels() -> list:
    """获取报告推送频道列表"""
    db = await get_db()
    cursor = await db.execute(
        "SELECT channel_id, channel_name FROM report_channels ORDER BY id",
    )
    rows = await cursor.fetchall()
    return [dict(r) for r in rows]


async def add_report_channel(channel_id: int, channel_name: str = ""):
    """添加报告推送频道"""
    db = await get_db()
    cursor = await db.execute(
        "SELECT id FROM report_channels WHERE channel_id = ?", (channel_id,)
    )
    if not await cursor.fetchone():
        await db.execute(
            "INSERT INTO report_channels (channel_id, channel_name) VALUES (?, ?)",
            (channel_id, channel_name),
        )
        await db.commit()


async def remove_report_channel(channel_id: int) -> bool:
    """删除报告推送频道"""
    db = await get_db()
    cursor = await db.execute(
        "DELETE FROM report_channels WHERE channel_id = ?",
        (channel_id,),
    )
    await db.commit()
    return cursor.rowcount > 0


# ============================================================
# 黑名单操作
# ============================================================

async def add_to_blacklist(user_id: int, user_name: str = "", reason: str = ""):
    """加入黑名单"""
    db = await get_db()
    cursor = await db.execute(
        "SELECT id FROM blacklist WHERE user_id = ?", (user_id,)
    )
    if await cursor.fetchone():
        await db.execute(
            "UPDATE blacklist SET user_name = ?, reason = ? WHERE user_id = ?",
            (user_name, reason, user_id),
        )
    else:
        await db.execute(
            "INSERT INTO blacklist (user_id, user_name, reason) VALUES (?, ?, ?)",
            (user_id, user_name, reason),
        )
    await db.commit()


async def remove_from_blacklist(user_id: int) -> bool:
    """从黑名单移除"""
    db = await get_db()
    cursor = await db.execute(
        "DELETE FROM blacklist WHERE user_id = ?",
        (user_id,),
    )
    await db.commit()
    return cursor.rowcount > 0


async def is_blacklisted(user_id: int) -> bool:
    """检查用户是否在黑名单"""
    db = await get_db()
    cursor = await db.execute(
        "SELECT id FROM blacklist WHERE user_id = ?",
        (user_id,),
    )
    row = await cursor.fetchone()
    return row is not None


async def get_blacklist(limit: int = 50) -> list:
    """获取黑名单列表"""
    db = await get_db()
    cursor = await db.execute(
        "SELECT user_id, user_name, reason, created_at FROM blacklist ORDER BY created_at DESC LIMIT ?",
        (limit,),
    )
    rows = await cursor.fetchall()
    return [dict(r) for r in rows]


# ============================================================
# 统计操作
# ============================================================

async def get_user_stats(user_id: int) -> dict:
    """获取用户统计信息"""
    db = await get_db()

    cursor = await db.execute(
        "SELECT COUNT(*) as cnt FROM quick_evaluations WHERE evaluator_id = ?",
        (user_id,),
    )
    quick_count = (await cursor.fetchone())["cnt"]

    cursor = await db.execute(
        "SELECT COUNT(*) as cnt FROM pending_reports WHERE submitter_id = ?",
        (user_id,),
    )
    report_count = (await cursor.fetchone())["cnt"]

    return {
        "quick_evaluations": quick_count,
        "submitted_reports": report_count,
    }


async def get_total_stats() -> dict:
    """获取全局统计数据"""
    db = await get_db()

    cursor = await db.execute("SELECT COUNT(*) as cnt FROM quick_evaluations")
    total_evals = (await cursor.fetchone())["cnt"]

    cursor = await db.execute(
        "SELECT COUNT(*) as cnt FROM pending_reports WHERE status = 'pending'"
    )
    pending_count = (await cursor.fetchone())["cnt"]

    cursor = await db.execute("SELECT COUNT(*) as cnt FROM published_reports")
    published_count = (await cursor.fetchone())["cnt"]

    cursor = await db.execute("SELECT COUNT(DISTINCT teacher_username) as cnt FROM quick_evaluations")
    teacher_count = (await cursor.fetchone())["cnt"]

    return {
        "total_evaluations": total_evals,
        "pending_reports": pending_count,
        "published_reports": published_count,
        "teacher_count": teacher_count,
    }


# ============================================================
# 用户追踪操作（用于广播）
# ============================================================

async def upsert_user(user_id: int, user_name: str = "", full_name: str = ""):
    """插入或更新用户记录"""
    db = await get_db()
    now = datetime.now(timezone.utc).isoformat()
    cursor = await db.execute(
        "SELECT id FROM users WHERE user_id = ?", (user_id,)
    )
    row = await cursor.fetchone()
    if row:
        await db.execute(
            "UPDATE users SET user_name = ?, full_name = ?, last_seen = ? WHERE user_id = ?",
            (user_name or "", full_name or "", now, user_id),
        )
    else:
        await db.execute(
            "INSERT INTO users (user_id, user_name, full_name, last_seen) VALUES (?, ?, ?, ?)",
            (user_id, user_name or "", full_name or "", now),
        )
    await db.commit()


async def get_all_users() -> list:
    """获取所有用户列表（用于广播）"""
    db = await get_db()
    cursor = await db.execute(
        "SELECT user_id, user_name, full_name FROM users ORDER BY last_seen DESC"
    )
    rows = await cursor.fetchall()
    return [dict(row) for row in rows]


async def get_user_count() -> int:
    """获取用户总数"""
    db = await get_db()
    cursor = await db.execute("SELECT COUNT(*) as cnt FROM users")
    row = await cursor.fetchone()
    return row["cnt"] if row else 0


# ============================================================
# 广播操作
# ============================================================

async def save_broadcast(
    sender_id: int,
    content_type: str,
    text: str = "",
    file_id: str = "",
    sent_count: int = 0,
    failed_count: int = 0,
) -> int:
    """保存广播记录，返回广播 ID"""
    db = await get_db()
    cursor = await db.execute(
        """INSERT INTO broadcasts (sender_id, content_type, text, file_id, sent_count, failed_count)
           VALUES (?, ?, ?, ?, ?, ?)""",
        (sender_id, content_type, text or "", file_id or "", sent_count, failed_count),
    )
    await db.commit()
    return cursor.lastrowid


async def get_broadcasts(limit: int = 20) -> list:
    """获取广播历史记录"""
    db = await get_db()
    cursor = await db.execute(
        """SELECT id, sender_id, content_type, text, sent_count, failed_count, created_at
           FROM broadcasts ORDER BY created_at DESC LIMIT ?""",
        (limit,),
    )
    rows = await cursor.fetchall()
    return [dict(row) for row in rows]


# ============================================================
# 机器人设置操作
# ============================================================

async def get_bot_setting(key: str) -> Optional[str]:
    """获取机器人设置值"""
    db = await get_db()
    cursor = await db.execute(
        "SELECT setting_value FROM bot_settings WHERE setting_key = ?",
        (key,),
    )
    row = await cursor.fetchone()
    return row["setting_value"] if row else None


async def set_bot_setting(key: str, value: str):
    """设置机器人设置值"""
    db = await get_db()
    now = datetime.now(timezone.utc).isoformat()
    cursor = await db.execute(
        "SELECT id FROM bot_settings WHERE setting_key = ?", (key,)
    )
    row = await cursor.fetchone()
    if row:
        await db.execute(
            "UPDATE bot_settings SET setting_value = ?, updated_at = ? WHERE setting_key = ?",
            (value, now, key),
        )
    else:
        await db.execute(
            "INSERT INTO bot_settings (setting_key, setting_value, updated_at) VALUES (?, ?, ?)",
            (key, value, now),
        )
    await db.commit()


async def get_start_settings() -> dict:
    """获取 /start 欢迎页设置"""
    db = await get_db()
    cursor = await db.execute(
        "SELECT setting_key, setting_value FROM bot_settings WHERE setting_key LIKE 'start_%'"
    )
    rows = await cursor.fetchall()
    return {row["setting_key"]: row["setting_value"] for row in rows}


async def save_start_settings(welcome_text: str = None, photo_file_id: str = None):
    """保存 /start 欢迎页设置"""
    if welcome_text is not None:
        await set_bot_setting("start_welcome_text", welcome_text)
    if photo_file_id is not None:
        await set_bot_setting("start_photo_file_id", photo_file_id)


async def get_menu_keyboard_settings() -> dict:
    """获取底部菜单键盘设置"""
    keys = [
        "menu_keyboard_enabled",
        "menu_btn_main",
        "menu_btn_main_action",
        "menu_btn_help",
        "menu_btn_help_action",
        "menu_btn_3",
        "menu_btn_3_action",
        "menu_btn_4",
        "menu_btn_4_action",
    ]
    result = {}
    for key in keys:
        result[key] = await get_bot_setting(key)
    return result


async def save_menu_keyboard_settings(
    enabled: bool = None,
    btn_main: str = None,
    btn_main_action: str = None,
    btn_help: str = None,
    btn_help_action: str = None,
    btn_3: str = None,
    btn_3_action: str = None,
    btn_4: str = None,
    btn_4_action: str = None,
):
    """保存底部菜单键盘设置"""
    if enabled is not None:
        await set_bot_setting("menu_keyboard_enabled", "1" if enabled else "0")
    if btn_main is not None:
        await set_bot_setting("menu_btn_main", btn_main)
    if btn_main_action is not None:
        await set_bot_setting("menu_btn_main_action", btn_main_action)
    if btn_help is not None:
        await set_bot_setting("menu_btn_help", btn_help)
    if btn_help_action is not None:
        await set_bot_setting("menu_btn_help_action", btn_help_action)
    if btn_3 is not None:
        await set_bot_setting("menu_btn_3", btn_3)
    if btn_3_action is not None:
        await set_bot_setting("menu_btn_3_action", btn_3_action)
    if btn_4 is not None:
        await set_bot_setting("menu_btn_4", btn_4)
    if btn_4_action is not None:
        await set_bot_setting("menu_btn_4_action", btn_4_action)
