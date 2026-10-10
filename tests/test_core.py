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
