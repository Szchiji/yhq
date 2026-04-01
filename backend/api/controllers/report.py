from datetime import datetime, timezone
from fastapi import Request
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_
from models.report import Report
from models.admin import Admin
from config import ADMIN_ID


async def submit_report(request: Request, db: AsyncSession) -> JSONResponse:
    try:
        body = await request.json()
        user_id = body.get("userId")
        if not user_id:
            return JSONResponse({"success": False, "message": "缺少 userId"}, status_code=400)

        tags = body.get("tags", [])
        if isinstance(tags, str):
            tags = [tags] if tags else []
        elif not isinstance(tags, list):
            tags = []

        report = Report(
            user_id=int(user_id),
            username=str(body.get("username") or "")[:256],
            first_name=str(body.get("firstName") or "")[:256],
            title=str(body.get("title") or "")[:1024],
            description=str(body.get("description") or ""),
            content=body.get("content") or {},
            tags=[str(t)[:128] for t in tags[:20]],
            status="pending",
        )
        db.add(report)
        await db.commit()
        await db.refresh(report)

        bot = request.app.state.bot
        if bot:
            tags_str = " ".join(f"#{t}" for t in (report.tags or []))
            content_preview = report.description or str(report.content)[:200]
            try:
                from telegram import InlineKeyboardButton, InlineKeyboardMarkup
                await bot.bot.send_message(
                    ADMIN_ID,
                    f"📬 *新报告待审核*\n\n"
                    f"报告编号：No.{report.report_number}\n"
                    f"提交人：{report.first_name or ''} @{report.username or str(report.user_id)}\n"
                    f"标题：{report.title or '无标题'}\n"
                    f"标签：{tags_str or '无'}\n\n"
                    f"内容：{content_preview}\n\n"
                    f"请在管理后台审核此报告。",
                    parse_mode="Markdown",
                    reply_markup=InlineKeyboardMarkup([[
                        InlineKeyboardButton("✅ 通过", callback_data=f"approve_{report.id}"),
                        InlineKeyboardButton("❌ 拒绝", callback_data=f"reject_{report.id}"),
                    ]]),
                )
            except Exception as e:
                print(f"Failed to notify admin: {e}")

            result = await db.execute(select(Admin).where(Admin.admin_id == ADMIN_ID))
            admin_cfg = result.scalar_one_or_none()
            pending_msg = (admin_cfg.review_feedback or {}).get("pending") if admin_cfg else None
            pending_msg = pending_msg or "⏳ 你的报告已提交，等待管理员审核。"
            try:
                await bot.bot.send_message(report.user_id, pending_msg)
            except Exception:
                pass

        return JSONResponse({"success": True, "data": report.to_dict()})
    except Exception as e:
        print(f"Error in {__name__}: {e}")
        return JSONResponse({"success": False, "message": "内部错误，请稍后重试"}, status_code=500)


async def get_reports(request: Request, db: AsyncSession) -> JSONResponse:
    try:
        status = request.query_params.get("status")
        page = max(1, int(request.query_params.get("page", "1") or "1"))
        limit = min(100, max(1, int(request.query_params.get("limit", "20") or "20")))

        valid_statuses = ("pending", "approved", "rejected")
        query = select(Report)
        count_query = select(func.count()).select_from(Report)
        if status and status in valid_statuses:
            query = query.where(Report.status == status)
            count_query = count_query.where(Report.status == status)

        query = query.order_by(Report.created_at.desc()).offset((page - 1) * limit).limit(limit)
        result = await db.execute(query)
        reports = result.scalars().all()
        total_result = await db.execute(count_query)
        total = total_result.scalar_one()

        return JSONResponse({
            "success": True,
            "data": [r.to_dict() for r in reports],
            "total": total,
            "page": page,
            "limit": limit,
        })
    except Exception as e:
        print(f"Error in {__name__}: {e}")
        return JSONResponse({"success": False, "message": "内部错误，请稍后重试"}, status_code=500)


async def review_report(request: Request, report_id: str, db: AsyncSession) -> JSONResponse:
    try:
        body = await request.json()
        status = body.get("status")
        review_note = str(body.get("reviewNote") or "")[:500]

        if status not in ("approved", "rejected"):
            return JSONResponse({"success": False, "message": "无效状态"}, status_code=400)

        result = await db.execute(select(Report).where(Report.id == report_id))
        report = result.scalar_one_or_none()
        if not report:
            return JSONResponse({"success": False, "message": "报告不存在"}, status_code=404)

        report.status = status
        report.review_note = review_note
        report.reviewed_at = datetime.now(timezone.utc)
        report.reviewed_by = ADMIN_ID
        await db.commit()
        await db.refresh(report)

        bot = request.app.state.bot
        admin_result = await db.execute(select(Admin).where(Admin.admin_id == ADMIN_ID))
        admin_cfg = admin_result.scalar_one_or_none()

        if status == "approved":
            if bot and admin_cfg and admin_cfg.push_channel_id:
                try:
                    tags_str = " ".join(f"#{t}" for t in (report.tags or []))
                    channel_msg = await bot.bot.send_message(
                        admin_cfg.push_channel_id,
                        f"📋 *报告推送* No.{report.report_number}\n\n"
                        f"👤 @{report.username or '匿名'}\n"
                        f"📌 {report.title or '无标题'}\n\n"
                        f"{report.description or ''}\n\n"
                        f"{'🏷 ' + tags_str if tags_str else ''}",
                        parse_mode="Markdown",
                    )
                    report.channel_message_id = channel_msg.message_id
                    await db.commit()
                except Exception as e:
                    print(f"Failed to push to channel: {e}")

            approved_msg = (admin_cfg.review_feedback or {}).get("approved") if admin_cfg else None
            approved_msg = approved_msg or "✅ 你的报告已通过审核，已推送到频道。"
            if bot and report.user_id:
                try:
                    await bot.bot.send_message(report.user_id, approved_msg)
                except Exception:
                    pass
        else:
            rejected_msg = (admin_cfg.review_feedback or {}).get("rejected") if admin_cfg else None
            rejected_msg = rejected_msg or "❌ 你的报告未通过审核，请修改后重新提交。"
            if review_note:
                rejected_msg += f"\n\n管理员备注：{review_note}"
            if bot and report.user_id:
                try:
                    await bot.bot.send_message(report.user_id, rejected_msg)
                except Exception:
                    pass

        return JSONResponse({"success": True, "data": report.to_dict()})
    except Exception as e:
        print(f"Error in {__name__}: {e}")
        return JSONResponse({"success": False, "message": "内部错误，请稍后重试"}, status_code=500)


async def search_reports(request: Request, db: AsyncSession) -> JSONResponse:
    try:
        q = request.query_params.get("q", "")
        search_type = request.query_params.get("type", "")
        if not q:
            return JSONResponse({"success": True, "data": []})

        safe_q = q[:100]
        safe_username = safe_q.lstrip("@")
        safe_tag = safe_q.lstrip("#")

        query = select(Report).where(Report.status == "approved")

        if search_type == "username":
            query = query.where(Report.username.ilike(f"%{safe_username}%"))
        elif search_type == "tag":
            query = query.where(
                func.lower(func.array_to_string(Report.tags, ",")).contains(safe_tag.lower())
            )
        else:
            query = query.where(or_(
                Report.username.ilike(f"%{safe_username}%"),
                func.lower(func.array_to_string(Report.tags, ",")).contains(safe_tag.lower()),
                Report.title.ilike(f"%{safe_q}%"),
            ))

        query = query.order_by(Report.created_at.desc()).limit(20)
        result = await db.execute(query)
        reports = result.scalars().all()
        return JSONResponse({"success": True, "data": [r.to_dict() for r in reports]})
    except Exception as e:
        print(f"Error in {__name__}: {e}")
        return JSONResponse({"success": False, "message": "内部错误，请稍后重试"}, status_code=500)
