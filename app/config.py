from dataclasses import dataclass
import os


@dataclass(frozen=True)
class Settings:
    app_name: str = os.getenv("APP_NAME", "STAR CYBER AI X")
    app_env: str = os.getenv("APP_ENV", "dev")
    api_token: str = os.getenv("STAR_API_TOKEN", "")
    database_path: str = os.getenv("DATABASE_PATH", "/data/starcyber.db")
    evidence_dir: str = os.getenv("EVIDENCE_DIR", "/data/evidence")

    llm_base_url: str = os.getenv("LLM_BASE_URL", "http://host.docker.internal:8000/v1")
    llm_api_key: str = os.getenv("LLM_API_KEY", "local")
    llm_model: str = os.getenv("LLM_MODEL", "Qwen3-Coder")
    llm_timeout: int = int(os.getenv("LLM_TIMEOUT", "120"))

    github_token: str = os.getenv("GITHUB_TOKEN", "")
    github_api_url: str = os.getenv("GITHUB_API_URL", "https://api.github.com")

    nuclei_rate_limit: int = int(os.getenv("NUCLEI_RATE_LIMIT", "10"))


settings = Settings()
