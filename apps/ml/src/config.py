from pydantic_settings import BaseSettings


# Explains what is expected of the env variables.
class Settings(BaseSettings):
    # Question analysis model provider. We can swap this to change model providers.
    QUESTION_ANALYSIS_MODEL: str = "gemini"

    # Body and sentence analysis share the same payload model; ``taskType`` selects the prompt.
    BODY_ANALYSIS_MODEL: str = "gemini"
    SENTENCE_ANALYSIS_MODEL: str = "gemini"

    # API Keys
    GEMINI_API_KEY: str = ""

    # Redis TCP settings for local/compose redis service.
    REDIS_HOST: str = "redis"
    REDIS_PORT: int = 6379
    REDIS_PASSWORD: str = ""

    # Postgres settings. 
    POSTGRES_USER: str = "postgres"
    POSTGRES_PASSWORD: str = "postgres"
    POSTGRES_DB: str = "postgres"
    DB_HOST: str = "postgres" 
    

    class Config:
        env_file = ".env"


settings = Settings()




