from fastapi import Request
from fastapi.responses import JSONResponse
from utils.auth import verify_telegram_init_data, generate_token
from config import ADMIN_ID


async def telegram_auth(request: Request) -> JSONResponse:
    try:
        body = await request.json()
        init_data = body.get("initData")
        if not init_data:
            return JSONResponse({"success": False, "message": "缺少 initData"}, status_code=400)

        user = verify_telegram_init_data(init_data)
        if not user:
            return JSONResponse({"success": False, "message": "initData 验证失败"}, status_code=401)

        is_admin = user.get("id") == ADMIN_ID
        token = generate_token({"userId": user["id"], "username": user.get("username", ""), "isAdmin": is_admin})

        return JSONResponse({
            "success": True,
            "token": token,
            "user": {
                "id": user["id"],
                "username": user.get("username", ""),
                "firstName": user.get("first_name", ""),
                "isAdmin": is_admin,
            },
        })
    except Exception as e:
        print(f"Error in {__name__}: {e}")
        return JSONResponse({"success": False, "message": "内部错误，请稍后重试"}, status_code=500)
