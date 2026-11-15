import json
import os
import sys
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError

account_id = os.environ.get("CLOUDFLARE_ACCOUNT_ID", "").strip()
api_token = os.environ.get("CLOUDFLARE_API_TOKEN", "").strip()
model = os.environ.get("CLOUDFLARE_AI_MODEL", "@cf/meta/llama-3.1-8b-instruct-fp8").strip()

if not account_id:
    print("ERROR: CLOUDFLARE_ACCOUNT_ID is missing.", file=sys.stderr)
    sys.exit(2)

if not api_token:
    print("ERROR: CLOUDFLARE_API_TOKEN is missing.", file=sys.stderr)
    sys.exit(2)

url = (
    "https://api.cloudflare.com/client/v4/accounts/"
    f"{account_id}/ai/v1/chat/completions"
)

payload = {
    "model": model,
    "messages": [
        {
            "role": "system",
            "content": (
                "You are a connectivity test for STAR CYBER AI X. "
                "Return a short plain response only."
            ),
        },
        {
            "role": "user",
            "content": "Reply exactly with: STAR AI ONLINE",
        },
    ],
    "temperature": 0,
    "max_tokens": 32,
}

request = Request(
    url,
    data=json.dumps(payload).encode("utf-8"),
    headers={
        "Authorization": f"Bearer {api_token}",
        "Content-Type": "application/json",
        "User-Agent": "star-cyber-ai-x-smoke-test",
    },
    method="POST",
)

try:
    with urlopen(request, timeout=60) as response:
        data = json.loads(response.read().decode("utf-8"))
except HTTPError as exc:
    body = exc.read().decode("utf-8", errors="replace")
    print(f"ERROR: Cloudflare returned HTTP {exc.code}.", file=sys.stderr)
    print(body[:2000], file=sys.stderr)
    sys.exit(1)
except URLError as exc:
    print(f"ERROR: Could not reach Cloudflare: {exc}", file=sys.stderr)
    sys.exit(1)

try:
    message = data["choices"][0]["message"]["content"]
except (KeyError, IndexError, TypeError):
    print("ERROR: Unexpected response shape.", file=sys.stderr)
    print(json.dumps(data)[:3000], file=sys.stderr)
    sys.exit(1)

print("Cloudflare Workers AI connection: OK")
print(f"Model: {model}")
print(f"Response: {message}")

if "STAR AI ONLINE" not in str(message):
    print("ERROR: Model responded, but smoke-test marker was not returned.", file=sys.stderr)
    sys.exit(1)
