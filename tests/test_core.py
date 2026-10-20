from app.burp_tools import compare_exchanges, inspect_exchange, inspect_jwt
from app.llm import _extract_json, redact_for_ai
from app.config import Settings
from app.github_intel import (
    is_text_candidate,
    review_priority,
    validate_repo_name,
)
from app.reports import render_report
from app.scanners import build_command, host_from_target


def test_host_from_target():
    assert host_from_target("https://example.com:8443/api") == "example.com"


def test_default_nmap_profile_is_non_destructive():
    command = build_command("nmap", "https://example.com")
    assert "-sT" in command
    assert "--script" not in command
    assert "-O" not in command
    assert "example.com" in command


def test_report_escapes_html():
    html = render_report(
        {"name": "<demo>", "description": "x"},
        [{
            "id": 1,
            "title": "<script>alert(1)</script>",
            "severity": "low",
            "status": "verified",
            "confidence": 90,
            "cwe": "CWE-1",
            "owasp": "A01",
            "summary": "<b>unsafe</b>",
            "remediation": "fix",
            "evidence_json": "{}",
        }],
    )
    assert "<script>alert(1)</script>" not in html
    assert "&lt;script&gt;alert(1)&lt;/script&gt;" in html


def test_repository_name_validation():
    assert validate_repo_name("owner/repo")
    assert validate_repo_name("a-b/c_d")
    assert not validate_repo_name("../repo")
    assert not validate_repo_name("owner")
    assert not validate_repo_name("owner/repo/extra")


def test_source_candidate_filter():
    assert is_text_candidate("app/main.py", 10_000)
    assert is_text_candidate("Dockerfile", 5_000)
    assert not is_text_candidate("image.png", 5_000)
    assert not is_text_candidate("app/main.py", 300_000)


def test_review_priority_prefers_auth_code():
    assert review_priority("app/auth/routes.py") > review_priority("assets/theme.css")


def test_jwt_passive_decode_and_observation():
    import base64
    import json

    def enc(value):
        raw = json.dumps(value, separators=(",", ":")).encode()
        return base64.urlsafe_b64encode(raw).decode().rstrip("=")

    token = enc({"alg": "none", "typ": "JWT"}) + "." + enc({"sub": "123"}) + ".sig"
    result = inspect_jwt(token)
    assert result["jwt_like"] is True
    assert result["header"]["alg"] == "none"
    assert any("alg=none" in item for item in result["observations"])
    assert any("no exp" in item for item in result["observations"])


def test_burp_exchange_inspection():
    request = "GET /account?id=1 HTTP/1.1\r\nHost: example.test\r\nCookie: sid=abc\r\n\r\n"
    response = "HTTP/1.1 200 OK\r\nContent-Type: text/html\r\nX-Content-Type-Options: nosniff\r\n\r\nhello"
    result = inspect_exchange(request, response)
    assert result["request"]["method"] == "GET"
    assert result["request"]["host"] == "example.test"
    assert result["request"]["query_keys"] == ["id"]
    assert result["response"]["status"] == 200
    assert result["response"]["security_headers"]["X-Content-Type-Options"] is True


def test_burp_compare_reports_status_and_body_delta():
    first = {
        "request": "GET /x HTTP/1.1\r\nHost: e.test\r\n\r\n",
        "response": "HTTP/1.1 403 Forbidden\r\n\r\nno",
    }
    second = {
        "request": "GET /x HTTP/1.1\r\nHost: e.test\r\n\r\n",
        "response": "HTTP/1.1 200 OK\r\n\r\nyes",
    }
    result = compare_exchanges(first, second)
    assert result["differences"]["status_changed"] is True
    assert result["first"]["response"]["status"] == 403
    assert result["second"]["response"]["status"] == 200


def test_llm_extract_json_from_fence():
    result = _extract_json('''```json
{"ok": true, "n": 3}
```''')
    assert result == {"ok": True, "n": 3}


def test_llm_redacts_credentials_before_provider_request():
    source = (
        "Authorization: Bearer top-secret-token\n"
        "Cookie: session=abc123\n"
        "password=hunter2\n"
        "x-api-key: shared-key-value\n"
    )
    redacted = redact_for_ai(source)
    assert "top-secret-token" not in redacted
    assert "session=abc123" not in redacted
    assert "hunter2" not in redacted
    assert "shared-key-value" not in redacted
    assert redacted.count("<redacted:") == 4


def test_cloudflare_provider_resolution():
    s = Settings(
        ai_provider="cloudflare",
        cloudflare_account_id="abc123",
        cloudflare_api_token="secret",
        cloudflare_ai_model="@cf/qwen/qwen3.8-27b",
    )
    base_url, key, model = s.resolved_llm()
    assert base_url == "https://api.cloudflare.com/client/v4/accounts/abc123/ai/v1"
    assert key == "secret"
    assert model == "@cf/qwen/qwen3.8-27b"


def test_self_hosted_provider_resolution():
    s = Settings(
        ai_provider="self_hosted",
        llm_base_url="http://localhost:8000/v1",
        llm_api_key="local",
        llm_model="demo",
    )
    assert s.resolved_llm() == (
        "http://localhost:8000/v1",
        "local",
        "demo",
    )
