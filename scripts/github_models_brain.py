import json
import os
import pathlib
import subprocess
import sys

token = os.environ.get("GITHUB_TOKEN", "").strip()
model = os.environ.get("GITHUB_MODELS_MODEL", "openai/gpt-4o").strip()
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

payload = json.dumps({
    "model": model,
    "messages": [
        {"role": "system", "content": system},
        {"role": "user", "content": prompt + "\n\nRepository context:\n" + "".join(context_parts)}
    ],
    "temperature": 0.1,
    "max_tokens": 3500
})

proc = subprocess.run(
    [
        "curl", "--silent", "--show-error", "--fail-with-body",
        "https://models.github.ai/inference/chat/completions",
        "-H", "Content-Type: application/json",
        "-H", f"Authorization: Bearer {token}",
        "-d", payload,
    ],
    text=True,
    capture_output=True,
    timeout=150,
)

if proc.returncode != 0:
    print("GitHub Models request failed.", file=sys.stderr)
    print(proc.stderr[:3000], file=sys.stderr)
    print(proc.stdout[:3000], file=sys.stderr)
    raise SystemExit(proc.returncode)

try:
    data = json.loads(proc.stdout)
    result = data["choices"][0]["message"]["content"]
except (json.JSONDecodeError, KeyError, IndexError, TypeError) as exc:
    print("Unexpected GitHub Models response.", file=sys.stderr)
    print(repr(proc.stdout[:3000]), file=sys.stderr)
    raise SystemExit(1) from exc

pathlib.Path("star-github-brain-report.md").write_text(result, encoding="utf-8")
print(result)
