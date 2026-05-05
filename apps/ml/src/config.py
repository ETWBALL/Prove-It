from pydantic_settings import BaseSettings

# Reads the env automatically and validates all fields exists

class Settings(BaseSettings):
    # Model provider. We can swap this to change model providers
    MODEL_PROVIDER: str = "gemini"
    
    # API Keys
    GEMINI_API_KEY: str = ""
    
    # Redis
    UPSTASH_REDIS_REST_URL: str = ""
    UPSTASH_REDIS_REST_TOKEN: str = ""

    class Config:
        env_file = ".env"

settings = Settings()
