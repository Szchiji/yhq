import os
from pathlib import Path
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
    frontend_dist = Path(os.path.dirname(__file__)).parent / "frontend-dist"
    frontend_dist = frontend_dist.resolve()
    if frontend_dist.is_dir():
        @app.get("/{full_path:path}")
        async def serve_spa(full_path: str):
            # Resolve and validate path stays within frontend_dist (prevents path traversal)
            try:
                resolved = (frontend_dist / full_path).resolve()
                resolved.relative_to(frontend_dist)  # raises ValueError if outside
            except (ValueError, OSError):
                resolved = frontend_dist
            if full_path and resolved.is_file():
                return FileResponse(str(resolved))
            index = frontend_dist / "index.html"
            if index.is_file():
                return FileResponse(str(index))
            raise HTTPException(status_code=404, detail="Not found")

    return app
