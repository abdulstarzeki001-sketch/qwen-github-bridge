import base64
import re
from pathlib import PurePosixPath
from urllib.parse import quote

import httpx

from .config import settings


REPO_RE = re.compile(r"^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$")
MAX_INDEXED_FILES = 5000
MAX_SOURCE_BYTES = 250_000

TEXT_SUFFIXES = {
    ".py", ".js", ".mjs", ".cjs", ".ts", ".tsx", ".jsx",
    ".java", ".go", ".rs", ".php", ".rb", ".c", ".h", ".cpp",
    ".cc", ".hpp", ".cs", ".swift", ".kt", ".kts", ".html",
    ".htm", ".css", ".scss", ".sql", ".graphql", ".gql",
    ".yaml", ".yml", ".json", ".toml", ".ini", ".cfg", ".conf",
    ".md", ".txt", ".sh", ".ps1", ".xml",
}
TEXT_NAMES = {
    "Dockerfile", "Containerfile", "Makefile", "Procfile",
    ".env.example", ".gitignore", "requirements.txt", "pyproject.toml",
    "package.json", "composer.json", "Gemfile",
}


def validate_repo_name(full_name: str) -> bool:
    if not REPO_RE.fullmatch(full_name or ""):
        return False
    owner, name = full_name.split("/", 1)
    return owner not in {".", ".."} and name not in {".", ".."}


def language_hint(path: str) -> str:
    name = PurePosixPath(path).name
    suffix = PurePosixPath(path).suffix.lower()
    if name in {"Dockerfile", "Containerfile"}:
        return "docker"
    return suffix.lstrip(".")


def is_text_candidate(path: str, size: int) -> bool:
    if size < 0 or size > MAX_SOURCE_BYTES:
        return False
    p = PurePosixPath(path)
    return p.name in TEXT_NAMES or p.suffix.lower() in TEXT_SUFFIXES


def review_priority(path: str) -> int:
    low = path.lower()
    score = 0
    for needle, weight in [
        ("auth", 30), ("login", 25), ("session", 25), ("token", 25),
        ("security", 25), ("permission", 22), ("admin", 20),
        ("api", 18), ("route", 16), ("controller", 16),
        ("middleware", 16), ("config", 14), ("main.", 12),
        ("app.", 10), ("server.", 10), ("database", 8), ("db.", 8),
    ]:
        if needle in low:
            score += weight
    if low.endswith((".py", ".js", ".ts", ".tsx", ".java", ".go", ".php", ".rb")):
        score += 6
    return score


class GitHubRepositoryClient:
    def __init__(self):
        headers = {
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
            "User-Agent": "star-cyber-ai-x",
        }
        if settings.github_token:
            headers["Authorization"] = f"Bearer {settings.github_token}"
        self.headers = headers
        self.base = settings.github_api_url.rstrip("/")

    async def _get(self, path: str):
        async with httpx.AsyncClient(timeout=45, headers=self.headers) as client:
            response = await client.get(self.base + path)
            response.raise_for_status()
            return response.json()

    async def repo_metadata(self, full_name: str):
        if not validate_repo_name(full_name):
            raise ValueError("Invalid repository name")
        return await self._get(f"/repos/{full_name}")

    async def tree(self, full_name: str, ref: str):
        if not validate_repo_name(full_name):
            raise ValueError("Invalid repository name")
        safe_ref = quote(ref, safe="")
        data = await self._get(f"/repos/{full_name}/git/trees/{safe_ref}?recursive=1")
        blobs = [
            item for item in data.get("tree", [])
            if item.get("type") == "blob"
            and is_text_candidate(item.get("path", ""), int(item.get("size", 0) or 0))
        ]
        blobs.sort(key=lambda x: (-review_priority(x.get("path", "")), x.get("path", "")))
        return blobs[:MAX_INDEXED_FILES], bool(data.get("truncated"))

    async def file_text(self, full_name: str, path: str, ref: str):
        if not validate_repo_name(full_name):
            raise ValueError("Invalid repository name")
        safe_path = "/".join(quote(part, safe="") for part in path.split("/"))
        safe_ref = quote(ref, safe="")
        data = await self._get(f"/repos/{full_name}/contents/{safe_path}?ref={safe_ref}")
        if data.get("type") != "file":
            raise ValueError("Path is not a file")
        size = int(data.get("size", 0) or 0)
        if not is_text_candidate(path, size):
            raise ValueError("File is not an allowed text source or is too large")
        if data.get("encoding") != "base64":
            raise ValueError("Unsupported GitHub content encoding")
        raw = base64.b64decode(data.get("content", ""), validate=False)
        return raw.decode("utf-8", errors="replace")
