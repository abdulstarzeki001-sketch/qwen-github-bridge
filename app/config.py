from dataclasses import dataclass
import os


@dataclass(frozen=True)
class Settings:
    app_name: str = os.getenv("APP_NAME", "STAR CYBER AI X")
    app_env: str = os.getenv("APP_ENV", "dev")
    api_token: str = os.getenv("STAR_API_TOKEN", "")
    database_path: str = os.getenv("DATABASE_PATH", "/data/starcyber.db")
    evidence_dir: str = os.getenv("EVIDENCE_DIR", "/data/evidence")

    ai_provider: str = os.getenv("AI_PROVIDER", "cloudflare").strip().lower()

    llm_base_url: str = os.getenv(
        "LLM_BASE_URL",
        "http://host.docker.internal:8000/v1",
    )
    llm_api_key: str = os.getenv("LLM_API_KEY", "local")
    llm_model: str = os.getenv("LLM_MODEL", "gpt-4.1-mini")
    llm_timeout: int = int(os.getenv("LLM_TIMEOUT", "120"))

    cloudflare_account_id: str = os.getenv("CLOUDFLARE_ACCOUNT_ID", "")
    cloudflare_api_token: str = os.getenv("CLOUDFLARE_API_TOKEN", "")
    cloudflare_ai_model: str = os.getenv(
        "CLOUDFLARE_AI_MODEL",
        "@cf/meta/llama-3.1-8b-instruct",
    )

    github_token: str = os.getenv("GITHUB_TOKEN", "")
    github_api_url: str = os.getenv("GITHUB_API_URL", "https://api.github.com")

    nuclei_rate_limit: int = int(os.getenv("NUCLEI_RATE_LIMIT", "10"))

    def resolved_llm(self) -> tuple[str, str, str]:
        if self.ai_provider == "cloudflare":
            if not self.cloudflare_account_id:
                raise RuntimeError("CLOUDFLARE_ACCOUNT_ID is not configured")
            if not self.cloudflare_api_token:
                raise RuntimeError("CLOUDFLARE_API_TOKEN is not configured")

            base_url = (
                "https://api.cloudflare.com/client/v4/accounts/"
                f"{self.cloudflare_account_id}/ai/v1"
            )
            return (
                base_url,
                self.cloudflare_api_token,
                self.cloudflare_ai_model,
            )

        if self.ai_provider in {"self_hosted", "openai_compatible", "generic"}:
            return self.llm_base_url, self.llm_api_key, self.llm_model

        raise RuntimeError(
            "AI_PROVIDER must be cloudflare, self_hosted, "
            "openai_compatible, or generic"
        )


settings = Settings()
