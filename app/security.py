from secrets import compare_digest

from fastapi import Header, HTTPException

from .config import settings


def require_api_token(authorization: str | None = Header(default=None)) -> None:
    if not settings.api_token:
        raise HTTPException(
            status_code=503,
            detail="STAR_API_TOKEN is not configured on the server.",
        )

    expected = f"Bearer {settings.api_token}"
    if authorization is None or not compare_digest(authorization, expected):
        raise HTTPException(status_code=401, detail="Unauthorized")
