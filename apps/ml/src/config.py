from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Model provider. We can swap this to change model providers.
    MODEL_PROVIDER: str = "gemini"

    # API Keys
    GEMINI_API_KEY: str = ""

    # Redis TCP settings for local/compose redis service.
    REDIS_HOST: str = "redis"
    REDIS_PORT: int = 6379
    REDIS_PASSWORD: str = ""

    class Config:
        env_file = ".env"


settings = Settings()
