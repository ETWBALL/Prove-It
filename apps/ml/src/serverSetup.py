import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI

from src.config import settings
from src.database import preload_all_definitions
from src.redis_listener import start_listener


@asynccontextmanager
async def lifespan(app: FastAPI):
    print(
        f"Starting ML service (question: {settings.QUESTION_ANALYSIS_MODEL}, "
        f"body: {settings.BODY_ANALYSIS_MODEL}, sentence: {settings.SENTENCE_ANALYSIS_MODEL})"
    )

    # One-time: definition library for all courses (in-process cache for ML workers).
    await asyncio.to_thread(preload_all_definitions)

    # Startup: begin listening to Redis
    listener_task = asyncio.create_task(start_listener())
    try:
        yield
    finally:
        listener_task.cancel()
        try:
            await listener_task
        except asyncio.CancelledError:
            pass
        # Shutdown: cleanup if needed
        print("ML service shutting down")


app = FastAPI(
    title="Prove-It ML Service",
    version="1.0.0",
    lifespan=lifespan,
)


@app.get("/health")
async def health():
    return {
        "status": "ok",
        "question_analysis_model": settings.QUESTION_ANALYSIS_MODEL,
        "body_analysis_model": settings.BODY_ANALYSIS_MODEL,
        "sentence_analysis_model": settings.SENTENCE_ANALYSIS_MODEL,
    }
