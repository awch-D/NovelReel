from pydantic_settings import BaseSettings
from pathlib import Path


class Settings(BaseSettings):
    LLM_BASE_URL: str = "https://jimu.ffa.chat"
    LLM_API_KEY: str = ""
    LLM_MODEL: str = "gpt-5.3-codex"
    IMAGE_BASE_URL: str = "https://jimu.ffa.chat"
    IMAGE_API_KEY: str = ""
    IMAGE_MODEL: str = "qwen3.5-plus-image"
    IMAGE_PROVIDER: str = "mock"  # "mock" | "api" | "jimeng"
    JIMENG_ACCESS_KEY_ID: str = ""
    JIMENG_SECRET_ACCESS_KEY: str = ""
    PROJECTS_DIR: Path = Path("../projects")

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()
