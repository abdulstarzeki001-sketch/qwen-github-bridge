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
