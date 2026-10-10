import json
import os
import sys
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError

token = os.environ.get("GITHUB_TOKEN", "").strip()
model = os.environ.get("GITHUB_MODELS_MODEL", "openai/gpt-4.1").strip()

if not token:
    print("ERROR: GITHUB_TOKEN is missing.", file=sys.stderr)
    sys.exit(2)

payload = {
    "model": model,
    "messages": [
        {
            "role": "system",
            "content": "You are the STAR CYBER AI X GitHub-native brain connectivity test."
        },
        {
            "role": "user",
            "content": "Reply exactly with: STAR GITHUB BRAIN ONLINE"
        }
    ],
    "temperature": 0,
    "max_tokens": 32
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
    with urlopen(req, timeout=60) as response:
        data = json.loads(response.read().decode("utf-8"))
except HTTPError as exc:
    body = exc.read().decode("utf-8", errors="replace")
    print(f"ERROR: GitHub Models returned HTTP {exc.code}", file=sys.stderr)
    print(body[:3000], file=sys.stderr)
    sys.exit(1)
except URLError as exc:
    print(f"ERROR: Could not reach GitHub Models: {exc}", file=sys.stderr)
    sys.exit(1)

try:
    message = data["choices"][0]["message"]["content"]
except (KeyError, IndexError, TypeError):
    print("ERROR: Unexpected GitHub Models response.", file=sys.stderr)
    print(json.dumps(data)[:3000], file=sys.stderr)
    sys.exit(1)

print("GitHub Models connection: OK")
print(f"Model: {model}")
print(f"Response: {message}")

if "STAR GITHUB BRAIN ONLINE" not in str(message):
    print("ERROR: Model responded but marker was not returned.", file=sys.stderr)
    sys.exit(1)
