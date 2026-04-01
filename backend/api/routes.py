from fastapi import APIRouter, Request, Depends
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
from db import get_db
from utils.auth import get_token_from_request, verify_token
from api.controllers.auth import telegram_auth
from api.controllers.admin import get_config, update_config
from api.controllers.report import submit_report, get_reports, review_report, search_reports

router = APIRouter()


def _auth(request: Request):
    token = get_token_from_request(request)
    if not token:
        return None
    return verify_token(token)


def _require_admin(request: Request):
    user = _auth(request)
    return user if user and user.get("isAdmin") else None


@router.post("/auth/telegram")
async def auth_telegram(request: Request):
    return await telegram_auth(request)


@router.get("/admin/config")
async def admin_get_config(request: Request, db: AsyncSession = Depends(get_db)):
    if not _require_admin(request):
        return JSONResponse({"success": False, "message": "无管理员权限"}, status_code=403)
    return await get_config(request, db)


@router.put("/admin/config")
async def admin_update_config(request: Request, db: AsyncSession = Depends(get_db)):
    if not _require_admin(request):
        return JSONResponse({"success": False, "message": "无管理员权限"}, status_code=403)
    return await update_config(request, db)


@router.get("/admin/reports")
async def admin_get_reports(request: Request, db: AsyncSession = Depends(get_db)):
    if not _require_admin(request):
        return JSONResponse({"success": False, "message": "无管理员权限"}, status_code=403)
    return await get_reports(request, db)


@router.put("/admin/reports/{report_id}/review")
async def admin_review_report(report_id: str, request: Request, db: AsyncSession = Depends(get_db)):
    if not _require_admin(request):
        return JSONResponse({"success": False, "message": "无管理员权限"}, status_code=403)
    return await review_report(request, report_id, db)


@router.post("/reports")
async def user_submit_report(request: Request, db: AsyncSession = Depends(get_db)):
    user = _auth(request)
    if not user:
        return JSONResponse({"success": False, "message": "未授权"}, status_code=401)
    return await submit_report(request, db)


@router.get("/reports/search")
async def user_search_reports(request: Request, db: AsyncSession = Depends(get_db)):
    return await search_reports(request, db)


@router.get("/health")
async def health():
    return {"status": "ok"}
