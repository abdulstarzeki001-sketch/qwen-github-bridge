import json
import os
import subprocess
import sys

token = os.environ.get("GITHUB_TOKEN", "").strip()
model = os.environ.get("GITHUB_MODELS_MODEL", "openai/gpt-4o").strip()

if not token:
    raise SystemExit("GITHUB_TOKEN is missing")

payload = json.dumps({
    "model": model,
    "messages": [
        {"role": "user", "content": "Reply exactly with: STAR GITHUB BRAIN ONLINE"}
    ]
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
    timeout=60,
)

if proc.returncode != 0:
    print("ERROR: GitHub Models curl request failed.", file=sys.stderr)
    print(proc.stderr[:2000], file=sys.stderr)
    print(proc.stdout[:2000], file=sys.stderr)
    raise SystemExit(proc.returncode)

raw = proc.stdout.strip()
try:
    data = json.loads(raw)
except json.JSONDecodeError:
    print("ERROR: GitHub Models returned non-JSON output.", file=sys.stderr)
    print("BODY_PREFIX=" + repr(raw[:1200]), file=sys.stderr)
    raise SystemExit(1)

try:
    message = data["choices"][0]["message"]["content"]
except (KeyError, IndexError, TypeError):
    print("ERROR: Unexpected GitHub Models response shape.", file=sys.stderr)
    print(json.dumps(data)[:3000], file=sys.stderr)
    raise SystemExit(1)

print("GitHub Models connection: OK")
print(f"Model: {model}")
print(f"Response: {message}")

if "STAR GITHUB BRAIN ONLINE" not in str(message):
    raise SystemExit("Model responded but the smoke-test marker was not returned.")
