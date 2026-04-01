from fastapi import Request
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from models.admin import Admin, _DEFAULT_KEYBOARDS, _DEFAULT_START_CONTENT, _DEFAULT_REVIEW_FEEDBACK, _DEFAULT_REPORT_TEMPLATE
from config import ADMIN_ID


async def get_config(request: Request, db: AsyncSession) -> JSONResponse:
    try:
        result = await db.execute(select(Admin).where(Admin.admin_id == ADMIN_ID))
        admin = result.scalar_one_or_none()
        if not admin:
            admin = Admin(admin_id=ADMIN_ID)
            db.add(admin)
            await db.commit()
            await db.refresh(admin)
        return JSONResponse({"success": True, "data": admin.to_dict()})
    except Exception as e:
        return JSONResponse({"success": False, "message": str(e)}, status_code=500)


async def update_config(request: Request, db: AsyncSession) -> JSONResponse:
    try:
        body = await request.json()
        result = await db.execute(select(Admin).where(Admin.admin_id == ADMIN_ID))
        admin = result.scalar_one_or_none()
        if not admin:
            admin = Admin(admin_id=ADMIN_ID)
            db.add(admin)

        if isinstance(body.get("channelId"), str):
            admin.channel_id = body["channelId"][:100]
        if isinstance(body.get("pushChannelId"), str):
            admin.push_channel_id = body["pushChannelId"][:100]
        if isinstance(body.get("startContent"), dict):
            sc = body["startContent"]
            start_content = dict(admin.start_content or _DEFAULT_START_CONTENT)
            if isinstance(sc.get("text"), str):
                start_content["text"] = sc["text"][:4096]
            if sc.get("mediaType") in ("none", "photo", "video"):
                start_content["mediaType"] = sc["mediaType"]
            if isinstance(sc.get("mediaUrl"), str):
                start_content["mediaUrl"] = sc["mediaUrl"][:1000]
            if isinstance(sc.get("buttons"), list):
                start_content["buttons"] = [
                    {
                        "text": str(b.get("text", ""))[:64],
                        "url": str(b.get("url", ""))[:500],
                        "action": str(b.get("action", ""))[:64],
                    }
                    for b in sc["buttons"][:10]
                ]
            admin.start_content = start_content
        if isinstance(body.get("keyboards"), list):
            admin.keyboards = [
                {
                    "text": str(k.get("text", ""))[:64],
                    "action": str(k.get("action", ""))[:64],
                }
                for k in body["keyboards"][:10]
            ]
        if isinstance(body.get("reviewFeedback"), dict):
            rf = body["reviewFeedback"]
            review_feedback = dict(admin.review_feedback or _DEFAULT_REVIEW_FEEDBACK)
            for field in ("approved", "rejected", "pending"):
                if isinstance(rf.get(field), str):
                    review_feedback[field] = rf[field][:1000]
            admin.review_feedback = review_feedback
        if isinstance(body.get("reportTemplate"), dict) and isinstance(body["reportTemplate"].get("fields"), list):
            admin.report_template = {
                "fields": [
                    {
                        "name": str(f.get("name", ""))[:64],
                        "label": str(f.get("label", ""))[:128],
                        "type": f.get("type") if f.get("type") in ("text", "textarea", "select") else "text",
                        "required": bool(f.get("required")),
                        "options": [str(o)[:128] for o in (f.get("options") or [])[:20]],
                    }
                    for f in body["reportTemplate"]["fields"][:20]
                ]
            }

        await db.commit()
        await db.refresh(admin)
        return JSONResponse({"success": True, "data": admin.to_dict()})
    except Exception as e:
        return JSONResponse({"success": False, "message": str(e)}, status_code=500)
