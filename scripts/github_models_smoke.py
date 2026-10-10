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
    "max_tokens": 32,
    "stream": False
}

req = Request(
    "https://models.github.ai/inference/chat/completions",
    data=json.dumps(payload).encode("utf-8"),
    headers={
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
        "Accept": "application/json",
        "User-Agent": "star-cyber-ai-x"
    },
    method="POST"
)

try:
    with urlopen(req, timeout=60) as response:
        raw_body = response.read().decode("utf-8", errors="replace")
        if not raw_body.strip():
            print(f"ERROR: Empty response from GitHub Models (HTTP {response.status}, Content-Type={response.headers.get('Content-Type')})", file=sys.stderr)
            sys.exit(1)
        try:
            data = json.loads(raw_body)
        except json.JSONDecodeError:
            print(
                "ERROR: GitHub Models returned a non-JSON body "
                f"(HTTP {response.status}, Content-Type={response.headers.get('Content-Type')}, "
                f"Length={len(raw_body)}).",
                file=sys.stderr,
            )
            print("BODY_PREFIX=" + repr(raw_body[:1200]), file=sys.stderr)
            sys.exit(1)
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
