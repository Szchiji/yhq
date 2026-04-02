import os
from pathlib import Path
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from starlette.exceptions import HTTPException as StarletteHTTPException
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


class _SPAStaticFiles(StaticFiles):
    """StaticFiles subclass that falls back to index.html for SPA routing."""

    async def get_response(self, path: str, scope):
        try:
            return await super().get_response(path, scope)
        except (StarletteHTTPException, Exception) as exc:
            if getattr(exc, "status_code", None) == 404:
                return await super().get_response("index.html", scope)
            raise


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

    # Serve frontend SPA — StaticFiles handles path safety internally
    frontend_dist = (Path(os.path.dirname(__file__)).parent / "frontend-dist").resolve()
    if frontend_dist.is_dir():
        app.mount("/", _SPAStaticFiles(directory=str(frontend_dist), html=True), name="frontend")

    return app
