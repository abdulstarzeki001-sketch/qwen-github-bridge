import json
import os
import pathlib
import subprocess
import sys
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError

token = os.environ.get("GITHUB_TOKEN", "").strip()
model = os.environ.get("GITHUB_MODELS_MODEL", "openai/gpt-4.1").strip()
prompt = os.environ.get("STAR_BRAIN_PROMPT", "").strip()

if not token:
    raise SystemExit("GITHUB_TOKEN is missing")
if not prompt:
    raise SystemExit("STAR_BRAIN_PROMPT is empty")

def git(*args):
    return subprocess.check_output(["git", *args], text=True, stderr=subprocess.DEVNULL)

files = []
for raw in git("ls-files").splitlines():
    p = pathlib.Path(raw)
    if p.suffix.lower() in {
        ".py",".js",".ts",".tsx",".jsx",".java",".go",".rs",".php",".rb",
        ".yml",".yaml",".json",".toml",".md",".html",".css",".sql",".sh"
    } or p.name in {"Dockerfile","Makefile","requirements.txt","package.json"}:
        try:
            size = p.stat().st_size
        except OSError:
            continue
        if size <= 80000:
            files.append((raw, size))

priority_terms = ("auth","security","api","route","middleware","main","config","db","database","token","session")
files.sort(key=lambda x: (0 if any(t in x[0].lower() for t in priority_terms) else 1, x[0]))
selected = files[:16]

context_parts = []
total = 0
for path, _ in selected:
    try:
        content = pathlib.Path(path).read_text(encoding="utf-8", errors="replace")
    except OSError:
        continue
    content = content[:30000]
    if total + len(content) > 180000:
        break
    context_parts.append(f"\n===== FILE: {path} =====\n{content}")
    total += len(content)

system = """You are STAR CYBER AI X operating inside GitHub Actions.
Perform defensive secure-code review only. Use only repository evidence supplied.
Do not invent vulnerabilities, runtime behavior, line numbers, or exploit success.
Return concise Markdown with:
1. Executive summary
2. Confirmed code observations
3. Suspected findings with severity and CWE when supported
4. Remediation priorities
5. What needs runtime validation
"""

user = prompt + "\n\nRepository context:\n" + "".join(context_parts)

payload = {
    "model": model,
    "messages": [
        {"role": "system", "content": system},
        {"role": "user", "content": user}
    ],
    "temperature": 0.1,
    "max_tokens": 3500
}

req = Request(
    "https://models.github.ai/inference/chat/completions",
    data=json.dumps(payload).encode("utf-8"),
    headers={
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
        "User-Agent": "star-cyber-ai-x"
    },
    method="POST"
)

try:
    with urlopen(req, timeout=120) as response:
        data = json.loads(response.read().decode("utf-8"))
except HTTPError as exc:
    body = exc.read().decode("utf-8", errors="replace")
    print(f"GitHub Models HTTP {exc.code}\n{body[:4000]}", file=sys.stderr)
    raise SystemExit(1)
except URLError as exc:
    print(f"Could not reach GitHub Models: {exc}", file=sys.stderr)
    raise SystemExit(1)

result = data["choices"][0]["message"]["content"]
out = pathlib.Path("star-github-brain-report.md")
out.write_text(result, encoding="utf-8")
print(result)
