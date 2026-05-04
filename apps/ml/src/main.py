from fastapi import FastAPI
from contextlib import asynccontextmanager
from src.config import settings
from src.redis_listener import start_listener

# (1) Lifespan manages startup and shutdown events
@asynccontextmanager
async def lifespan(app: FastAPI):
    
    # Startup: begin listening to Redis
    print(f"Starting ML service with provider: {settings.MODEL_PROVIDER}")
    await start_listener()
    yield


    # Shutdown: cleanup if needed
    print("ML service shutting down")

# (2) Create the FastAPI app
app = FastAPI(
    title="Prove-It ML Service",
    version="1.0.0",
    lifespan=lifespan
)

# (3) Health check endpoint
@app.get("/health")
async def health():
    return {
        "status": "ok",
        "provider": settings.MODEL_PROVIDER
    }
