import os
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from telegram import Update
from config import WEBHOOK_DOMAIN, BOT_TOKEN, FRONTEND_URL, API_URL, PORT
from db import init_db
from bot.create_bot import create_bot_app


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    bot_app = create_bot_app()
    app.state.bot = bot_app

    await bot_app.initialize()
    await bot_app.start()

    if WEBHOOK_DOMAIN:
        webhook_url = f"{WEBHOOK_DOMAIN}/webhook/{BOT_TOKEN}"
        await bot_app.bot.set_webhook(url=webhook_url)
        print(f"Bot webhook set: {webhook_url}")
    else:
        await bot_app.updater.start_polling()
        print("Bot started in polling mode")

    yield

    if not WEBHOOK_DOMAIN:
        await bot_app.updater.stop()
    else:
        await bot_app.bot.delete_webhook()
    await bot_app.stop()
    await bot_app.shutdown()


def create_app() -> FastAPI:
    from api.routes import router

    app = FastAPI(lifespan=lifespan, docs_url=None, redoc_url=None)

    allowed_origins = [o for o in [FRONTEND_URL, API_URL, WEBHOOK_DOMAIN] if o]
    app.add_middleware(
        CORSMiddleware,
        allow_origins=allowed_origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        allow_headers=["Content-Type", "Authorization"],
    )

    @app.post("/webhook/{token}")
    async def telegram_webhook(token: str, request: Request):
        if token != BOT_TOKEN:
            raise HTTPException(status_code=403, detail="Invalid token")
        data = await request.json()
        update = Update.de_json(data, request.app.state.bot.bot)
        await request.app.state.bot.process_update(update)
        return {"ok": True}

    app.include_router(router, prefix="/api")

    # Serve frontend static files if built dist exists
    frontend_dist = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "frontend-dist"))
    if os.path.isdir(frontend_dist):
        @app.get("/{full_path:path}")
        async def serve_spa(full_path: str):
            # Resolve and validate path stays within frontend_dist
            safe_path = os.path.normpath(os.path.join(frontend_dist, full_path))
            if not safe_path.startswith(frontend_dist + os.sep) and safe_path != frontend_dist:
                safe_path = frontend_dist
            if full_path and os.path.isfile(safe_path):
                return FileResponse(safe_path)
            index = os.path.join(frontend_dist, "index.html")
            if os.path.isfile(index):
                return FileResponse(index)
            raise HTTPException(status_code=404, detail="Not found")

    return app
