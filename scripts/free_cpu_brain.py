import json
import os
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError

MODEL = os.getenv("STAR_CPU_MODEL", "qwen2.5-coder:1.5b-instruct")
ENDPOINT = os.getenv("OLLAMA_URL", "http://127.0.0.1:11434/api/chat")
MAX_TOTAL_CHARS = 22000
MAX_FILE_CHARS = 4000

ALLOWED_SUFFIXES = {
    ".py", ".js", ".mjs", ".cjs", ".ts", ".tsx", ".jsx",
    ".java", ".go", ".rs", ".php", ".rb", ".c", ".h", ".cpp",
    ".cs", ".swift", ".kt", ".html", ".css", ".scss", ".sql",
    ".graphql", ".gql", ".yaml", ".yml", ".json", ".toml", ".ini",
    ".cfg", ".conf", ".md", ".sh", ".xml"
}
SPECIAL_NAMES = {
    "Dockerfile", "Containerfile", "Makefile", "requirements.txt",
    "pyproject.toml", "package.json", "composer.json", "Gemfile"
}
PRIORITY = (
    "auth", "security", "login", "session", "token", "permission",
    "admin", "api", "route", "middleware", "config", "main", "db", "database"
)


def priority(path: str) -> tuple[int, str]:
    low = path.lower()
    score = sum(1 for term in PRIORITY if term in low)
    return (-score, path)


def read_text(path: str) -> str:
    try:
        return Path(path).read_text(encoding="utf-8", errors="replace")
    except OSError:
        return ""


def deterministic_facts() -> list[str]:
    facts = []
    main = read_text("app/main.py")
    security = read_text("app/security.py")
    gitignore = read_text(".gitignore")
    config = read_text("app/config.py")

    protected_count = main.count("Depends(require_api_token)")
    if protected_count:
        facts.append(
            f"FastAPI declares Depends(require_api_token) on {protected_count} protected route definitions."
        )

    if "compare_digest" in security and "HTTPException(status_code=401" in security:
        facts.append(
            "app/security.py compares bearer credentials with secrets.compare_digest and returns HTTP 401 on mismatch."
        )

    if '@app.get("/api/health")' in main:
        facts.append("The /api/health endpoint is public for health monitoring.")

    if ".env" in gitignore:
        facts.append(".env is excluded by .gitignore.")

    if 'api_token: str = os.getenv("STAR_API_TOKEN"' in config:
        facts.append("STAR_API_TOKEN is loaded from the process environment in app/config.py.")

    return facts


def collect_context() -> tuple[str, list[str]]:
    candidates = []
    for p in Path(".").rglob("*"):
        if not p.is_file():
            continue
        if any(part.startswith(".git") for part in p.parts):
            continue
        if "legacy" in p.parts or "node_modules" in p.parts or "__pycache__" in p.parts:
            continue
        try:
            size = p.stat().st_size
        except OSError:
            continue
        if size > 120_000:
            continue
        if p.name in SPECIAL_NAMES or p.suffix.lower() in ALLOWED_SUFFIXES:
            candidates.append(str(p))

    candidates.sort(key=priority)
    total = 0
    chunks = []
    used = []

    for raw in candidates:
        if len(used) >= 9:
            break
        content = read_text(raw)
        if not content:
            continue
        content = content[:MAX_FILE_CHARS]
        if total + len(content) > MAX_TOTAL_CHARS:
            remain = MAX_TOTAL_CHARS - total
            if remain <= 0:
                break
            content = content[:remain]
        chunks.append(f"\n===== FILE: {raw} =====\n{content}")
        used.append(raw)
        total += len(content)

    return "".join(chunks), used


def call_ollama(messages, max_tokens: int):
    payload = {
        "model": MODEL,
        "messages": messages,
        "stream": False,
        "options": {
            "temperature": 0.05,
            "num_predict": max_tokens,
            "num_ctx": 12288,
        },
    }
    req = Request(
        ENDPOINT,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urlopen(req, timeout=900) as response:
            data = json.loads(response.read().decode("utf-8"))
    except HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        raise SystemExit(f"Ollama HTTP {exc.code}: {body[:2000]}") from exc
    except URLError as exc:
        raise SystemExit(f"Could not reach Ollama: {exc}") from exc

    try:
        return data["message"]["content"]
    except (KeyError, TypeError) as exc:
        raise SystemExit("Unexpected Ollama response: " + json.dumps(data)[:2000]) from exc


smoke = call_ollama(
    [{"role": "user", "content": "Reply exactly with: STAR CPU BRAIN ONLINE"}],
    32,
)
print("Smoke:", smoke)

context, files = collect_context()
facts = deterministic_facts()

system = """You are STAR CYBER AI X running as a small local model on a GitHub Actions CPU runner.
Perform a defensive code-quality and security review only.
Accuracy rules:
- DETERMINISTIC FACTS are higher-authority than your own inference.
- Never contradict a deterministic fact.
- If protected routes use require_api_token, do not claim those routes lack authentication.
- A local desktop configuration panel is not a remote authentication boundary.
- Do not repeat the same observation in multiple sections.
- Every review candidate must name a file and include an exact short code quote.
- If evidence is weak, say that no confirmed issue was established.
- Never invent line numbers, credentials, runtime behavior, or network observations.
"""

user = f"""Review this repository conservatively.

Return Markdown with exactly these sections:
# STAR CPU Brain Report
## Deterministic Security Facts
## Evidence-Based Review Candidates
## Remediation Priorities
## Runtime Validation Needed

Rules:
- Maximum 4 review candidates.
- Each candidate must include: confidence, file, exact code quote, rationale, and recommendation.
- Candidates are advisory and must not be described as confirmed runtime issues.
- Do not repeat candidates.
- Prefer saying 'no strong evidence found' over guessing.

DETERMINISTIC FACTS:
{json.dumps(facts, indent=2)}

REPOSITORY CONTEXT:
{context}
"""

report = call_ollama(
    [
        {"role": "system", "content": system},
        {"role": "user", "content": user},
    ],
    650,
)

metadata = (
    "# STAR CPU Brain Run Metadata\n\n"
    f"- Model: \`{MODEL}\`\n"
    f"- Files reviewed: {len(files)}\n"
    "- Runtime: GitHub Actions CPU / Ollama\n"
    "- External AI credential: none\n"
    "- Evidence policy: deterministic repository facts outrank model inference\n\n"
    "Files:\n" + "\n".join(f"- \`{p}\`" for p in files) + "\n\n"
)

Path("star-cpu-brain-report.md").write_text(metadata + report, encoding="utf-8")
print(report)
