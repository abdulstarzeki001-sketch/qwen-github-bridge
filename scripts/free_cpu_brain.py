import json
import os
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError

MODEL = os.getenv("STAR_CPU_MODEL", "qwen2.5-coder:1.5b-instruct")
ENDPOINT = os.getenv("OLLAMA_URL", "http://127.0.0.1:11434/api/chat")

CHECK_PATTERNS = (
    ("shell=True", "Python subprocess call enables a shell."),
    ("verify=False", "TLS certificate verification is explicitly disabled."),
    ("eval(", "Dynamic eval() call requires manual review."),
    ("exec(", "Dynamic exec() call requires manual review."),
    ("pickle.loads(", "pickle.loads() processes serialized Python objects."),
    ("yaml.load(", "yaml.load() should be checked for a safe loader."),
    ("Runtime.getRuntime().exec(", "Java Runtime.exec() launches an external process."),
    ("new ProcessBuilder(", "Java ProcessBuilder launches an external process."),
)


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


def reviewable_files() -> list[Path]:
    roots = [Path("app"), Path("burp-extension/src/main/java")]
    out = []
    for root in roots:
        if not root.exists():
            continue
        for path in root.rglob("*"):
            if path.is_file() and path.suffix.lower() in {".py", ".java", ".js", ".ts"}:
                out.append(path)
    return sorted(out)


def deterministic_signals() -> list[dict]:
    signals = []
    for path in reviewable_files():
        text = read_text(str(path))
        if not text:
            continue
        for line_number, line in enumerate(text.splitlines(), start=1):
            stripped = line.strip()
            if not stripped or stripped.startswith("#") or stripped.startswith("//"):
                continue
            for needle, description in CHECK_PATTERNS:
                if needle in line:
                    signals.append(
                        {
                            "file": str(path),
                            "line": line_number,
                            "match": needle,
                            "description": description,
                            "excerpt": stripped[:220],
                        }
                    )
    return signals[:20]


def call_ollama(messages, max_tokens: int):
    payload = {
        "model": MODEL,
        "messages": messages,
        "stream": False,
        "options": {
            "temperature": 0.0,
            "num_predict": max_tokens,
            "num_ctx": 4096,
        },
    }
    req = Request(
        ENDPOINT,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urlopen(req, timeout=600) as response:
            data = json.loads(response.read().decode("utf-8"))
    except HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        raise SystemExit(f"Ollama HTTP {exc.code}: {body[:2000]}") from exc
    except URLError as exc:
        raise SystemExit(f"Could not reach Ollama: {exc}") from exc

    try:
        return data["message"]["content"].strip()
    except (KeyError, TypeError) as exc:
        raise SystemExit("Unexpected Ollama response: " + json.dumps(data)[:2000]) from exc


def bullet_lines(items: list[str]) -> str:
    if not items:
        return "- None."
    return "\n".join(f"- {item}" for item in items)


def signal_lines(signals: list[dict]) -> str:
    if not signals:
        return "- No configured high-signal code patterns were detected."
    rows = []
    for item in signals:
        rows.append(
            f"- \`{item['file']}:{item['line']}\` — {item['description']} "
            f"Matched \`{item['match']}\`. Evidence: \`{item['excerpt']}\`"
        )
    return "\n".join(rows)


smoke = call_ollama(
    [{"role": "user", "content": "Reply exactly with: STAR CPU BRAIN ONLINE"}],
    24,
)
print("Smoke:", smoke)

facts = deterministic_facts()
signals = deterministic_signals()

summary_prompt = f"""You are a small local model used only as a report explainer.

You MUST use only the supplied deterministic facts and deterministic code signals.
Do not invent additional findings, files, line numbers, risks, credentials, or runtime behavior.
Do not restate a signal as proven exploitable.
Write 4 to 7 concise sentences:
- summarize the current security posture,
- explain what the signals mean if any,
- state what should be validated next.
If signals are empty, say that the configured quick checks found no high-signal code pattern.

FACTS:
{json.dumps(facts, indent=2)}

SIGNALS:
{json.dumps(signals, indent=2)}
"""

ai_summary = call_ollama(
    [{"role": "user", "content": summary_prompt}],
    260,
)

report = f"""# STAR CPU Brain Report

## Run Metadata

- Model: \`{MODEL}\`
- Runtime: GitHub Actions CPU / Ollama
- External AI credential: none
- Report mode: deterministic-first
- AI role: explanation only; it cannot add findings

## Deterministic Security Facts

{bullet_lines(facts)}

## Deterministic Code Signals

{signal_lines(signals)}

## AI Interpretation (Non-Authoritative)

{ai_summary}

## Validation Notes

- A deterministic code signal is a review pointer, not proof of a security issue.
- Runtime behavior is not inferred from this CPU workflow.
- The always-on STAR runtime should use the stronger provider path when available.
"""

Path("star-cpu-brain-report.md").write_text(report, encoding="utf-8")
print(report)
