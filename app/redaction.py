import hashlib
import json
import re
from typing import Any


SENSITIVE_HEADERS = {
    "authorization",
    "proxy-authorization",
    "cookie",
    "set-cookie",
    "x-api-key",
    "api-key",
    "x-auth-token",
    "x-access-token",
    "cf-access-client-secret",
}

SENSITIVE_KEYS = {
    "password",
    "passwd",
    "pass",
    "pwd",
    "secret",
    "client_secret",
    "api_key",
    "apikey",
    "access_token",
    "refresh_token",
    "id_token",
    "token",
    "authorization",
    "cookie",
}

TOKEN_PATTERNS = [
    re.compile(r"(?i)\bBearer\s+([A-Za-z0-9._~+/-]{12,}=*)"),
    re.compile(r"\bsk-[A-Za-z0-9_-]{16,}\b"),
    re.compile(r"\bgh[pousr]_[A-Za-z0-9]{20,}\b"),
    re.compile(r"\bgithub_pat_[A-Za-z0-9_]{20,}\b"),
    re.compile(r"\b(?:eyJ[A-Za-z0-9_-]{8,})\.(?:eyJ[A-Za-z0-9_-]{8,})\.[A-Za-z0-9_-]{8,}\b"),
]

KV_PATTERN = re.compile(
    r"(?i)(\b(?:password|passwd|pwd|secret|client_secret|api[_-]?key|access[_-]?token|refresh[_-]?token)\b\s*[:=]\s*)([^&\s,;]+)"
)


def _marker(value: str) -> str:
    digest = hashlib.sha256(value.encode("utf-8", errors="ignore")).hexdigest()[:12]
    return f"<redacted:{digest}>"


def _redact_scalar(value: Any) -> Any:
    if isinstance(value, str):
        return _marker(value) if value else value
    if value is None:
        return None
    return _marker(str(value))


def _redact_json(value: Any) -> Any:
    if isinstance(value, dict):
        result = {}
        for key, item in value.items():
            if str(key).lower() in SENSITIVE_KEYS:
                result[key] = _redact_scalar(item)
            else:
                result[key] = _redact_json(item)
        return result
    if isinstance(value, list):
        return [_redact_json(item) for item in value]
    if isinstance(value, str):
        return redact_text(value)
    return value


def redact_text(text: str) -> str:
    value = text or ""

    for pattern in TOKEN_PATTERNS:
        def replace_token(match: re.Match) -> str:
            whole = match.group(0)
            if whole.lower().startswith("bearer "):
                return "Bearer " + _marker(match.group(1))
            return _marker(whole)

        value = pattern.sub(replace_token, value)

    value = KV_PATTERN.sub(lambda m: m.group(1) + _marker(m.group(2)), value)
    return value


def redact_http_message(raw: str) -> str:
    raw = raw or ""
    separator = "\r\n\r\n" if "\r\n\r\n" in raw else "\n\n"
    if separator in raw:
        head, body = raw.split(separator, 1)
    else:
        head, body = raw, ""

    redacted_headers = []
    for line in head.splitlines():
        if ":" in line:
            name, value = line.split(":", 1)
            if name.strip().lower() in SENSITIVE_HEADERS:
                line = f"{name}: {_marker(value.strip())}"
            else:
                line = redact_text(line)
        else:
            line = redact_text(line)
        redacted_headers.append(line)

    body_out = body
    stripped = body.strip()
    if stripped:
        try:
            parsed = json.loads(body)
            body_out = json.dumps(_redact_json(parsed), ensure_ascii=False, separators=(",", ":"))
        except (json.JSONDecodeError, TypeError):
            body_out = redact_text(body)

    return "\n".join(redacted_headers) + (separator + body_out if body else "")


def redact_source_text(text: str) -> str:
    return redact_text(text or "")
