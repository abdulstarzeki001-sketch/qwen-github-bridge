import json
import os
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError

MODEL = os.getenv("STAR_CPU_MODEL", "qwen2.5-coder:1.5b-instruct")
ENDPOINT = os.getenv("OLLAMA_URL", "http://127.0.0.1:11434/api/chat")
MAX_TOTAL_CHARS = 28000
MAX_FILE_CHARS = 4500

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
        if len(used) >= 10:
            break
        p = Path(raw)
        try:
            content = p.read_text(encoding="utf-8", errors="replace")
        except OSError:
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
            "temperature": 0.1,
            "num_predict": max_tokens,
            "num_ctx": 16384
        }
    }
    req = Request(
        ENDPOINT,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST"
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
    32
)
print("Smoke:", smoke)

context, files = collect_context()
system = """You are STAR CYBER AI X running locally on a GitHub Actions CPU runner.
Perform defensive secure-code review only.
Use only the supplied repository evidence.
Do not invent vulnerabilities, line numbers, runtime exploit success, credentials, or network observations.
Prioritize authentication, authorization, secrets, API security, unsafe configuration, dependency/supply-chain risk, and evidence quality.
Keep the report concise and actionable.
"""

user = """Review this repository defensively.
Return Markdown with exactly these sections:
# STAR CPU Brain Report
## Executive Summary
## Evidence-Based Findings
## Remediation Priorities
## Runtime Validation Needed

For each finding include severity, CWE only when supported, affected file, code evidence, and remediation.
If evidence is insufficient, say so rather than guessing.

Repository context:
""" + context

report = call_ollama(
    [
        {"role": "system", "content": system},
        {"role": "user", "content": user}
    ],
    1000
)

header = (
    "# STAR CPU Brain Run Metadata\n\n"
    f"- Model: \`{MODEL}\`\n"
    f"- Files reviewed: {len(files)}\n"
    "- Runtime: GitHub Actions CPU / Ollama\n"
    "- External AI credential: none\n\n"
    "Files:\n" + "\n".join(f"- \`{p}\`" for p in files) + "\n\n"
)

Path("star-cpu-brain-report.md").write_text(header + report, encoding="utf-8")
print(report)
