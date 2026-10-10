from datetime import datetime, timezone
from html import escape


def render_report(project: dict, findings: list[dict]) -> str:
    severity_order = {"critical": 0, "high": 1, "medium": 2, "low": 3, "info": 4}
    findings = sorted(findings, key=lambda f: severity_order.get(f["severity"], 99))

    cards = []
    for finding in findings:
        cards.append(f"""
        <article class="finding">
          <div class="head">
            <h2>#{finding['id']} {escape(finding['title'])}</h2>
            <strong>{escape(finding['severity'].upper())}</strong>
          </div>
          <p>Status: {escape(finding['status'])} · Confidence: {finding['confidence']}%</p>
          <p>CWE: {escape(finding.get('cwe') or '—')} · OWASP: {escape(finding.get('owasp') or '—')}</p>
          <h3>Summary</h3>
          <pre>{escape(finding.get('summary') or '')}</pre>
          <h3>Remediation</h3>
          <pre>{escape(finding.get('remediation') or '')}</pre>
          <h3>Evidence</h3>
          <pre>{escape(finding.get('evidence_json') or '{}')}</pre>
        </article>
        """)

    body = "".join(cards) if cards else "<p>No findings recorded.</p>"

    return f"""<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>{escape(project['name'])} - Security Report</title>
<style>
body{{font-family:system-ui,sans-serif;background:#07101c;color:#eaf2ff;margin:0}}
main{{max-width:1000px;margin:auto;padding:28px 16px 80px}}
header,.finding{{background:#0d1928;border:1px solid #21354b;border-radius:18px;padding:20px;margin-bottom:16px}}
.head{{display:flex;justify-content:space-between;gap:16px;align-items:center}}
pre{{white-space:pre-wrap;word-break:break-word;background:#060d16;border:1px solid #21354b;padding:14px;border-radius:12px}}
p{{color:#9db0c4}}
@media print{{body{{background:white;color:black}} header,.finding,pre{{background:white;color:black;border-color:#bbb}}}}
</style>
</head>
<body><main>
<header>
<h1>{escape(project['name'])}</h1>
<p>STAR CYBER AI X - Security Assessment Report</p>
<p>Generated: {datetime.now(timezone.utc).isoformat()}</p>
</header>
{body}
</main></body></html>"""
