import hashlib
import json
import re

import httpx

from .config import settings


ANALYST_SYSTEM = """You are STAR CYBER AI X, a senior application security analyst.
Analyze only the supplied authorized test evidence.
Focus on authentication, authorization, session handling, input validation,
data exposure, business logic, API/WebSocket security, and configuration.
Return JSON only with: title, severity, status, confidence, cwe, owasp,
summary, evidence, remediation, validation_notes.
Never invent evidence. If proof is insufficient, use status suspected or likely.
"""

VERIFIER_SYSTEM = """You are an independent security finding verifier.
Given a proposed finding and raw evidence, decide whether the claim is supported.
Return JSON only with: supported, confidence, rationale, missing_evidence,
safer_retest_plan. Never invent observations.
"""

CODE_REVIEW_SYSTEM = """You are STAR CYBER AI X performing defensive secure-code review.
Review only the supplied repository source files. Identify security weaknesses
that are directly supported by code evidence. Do not invent files, line numbers,
runtime behavior, or exploit success. Prefer root-cause analysis and concrete
remediation. Return JSON only:
{
  "overview": "short summary",
  "findings": [
    {
      "title": "...",
      "severity": "critical|high|medium|low|info",
      "confidence": 0,
      "cwe": "CWE-...",
      "owasp": "...",
      "file": "path",
      "evidence": "what the code shows",
      "summary": "risk and root cause",
      "remediation": "specific defensive fix"
    }
  ]
}
If evidence is weak, omit the finding rather than guessing.
"""

RETEST_SYSTEM = """You are an independent security retest verifier.
Compare an original finding with new authorized HTTP evidence.
Return JSON only with:
verdict ("fix-verified"|"still-vulnerable"|"inconclusive"),
confidence (0-100),
rationale,
evidence.
Only use fix-verified when the new evidence clearly demonstrates the original
weakness is no longer reproducible under an equivalent test condition.
Never invent observations.
"""


SENSITIVE_HEADER_RE = re.compile(
    r"(?im)^(Authorization|Proxy-Authorization|Cookie|Set-Cookie|"
    r"X-API-Key|API-Key|X-Auth-Token|X-Amz-Security-Token):[ \t]*(.+)$"
)
SECRET_ASSIGNMENT_RE = re.compile(
    r"(?i)\b(password|passwd|secret|api[_-]?key|access[_-]?token|"
    r"refresh[_-]?token|client[_-]?secret)\b"
    r"(\s*[\"']?\s*[:=]\s*[\"']?)([^\"'\s,&}\]]{4,})"
)
TOKEN_RE = re.compile(
    r"(?x)"
    r"(?:sk-ant-[A-Za-z0-9_-]{12,}|"
    r"sk-(?:proj-)?[A-Za-z0-9_-]{20,}|"
    r"github_pat_[A-Za-z0-9_]{20,}|"
    r"gh[pousr]_[A-Za-z0-9]{20,}|"
    r"AKIA[0-9A-Z]{16}|"
    r"eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,})"
)


def _redaction_marker(value: str) -> str:
    digest = hashlib.sha256(value.encode("utf-8", errors="ignore")).hexdigest()[:12]
    return f"<redacted:{digest}>"


def redact_for_ai(text: str) -> str:
    """Remove high-risk credentials before text leaves STAR for an LLM provider.

    Raw evidence remains in STAR's evidence store. Stable hashes preserve enough
    identity to compare whether the same secret appeared in more than one place.
    """
    value = text or ""

    def header_repl(match: re.Match) -> str:
        return f"{match.group(1)}: {_redaction_marker(match.group(2).strip())}"

    value = SENSITIVE_HEADER_RE.sub(header_repl, value)

    def assignment_repl(match: re.Match) -> str:
        return (
            match.group(1)
            + match.group(2)
            + _redaction_marker(match.group(3))
        )

    value = SECRET_ASSIGNMENT_RE.sub(assignment_repl, value)
    value = TOKEN_RE.sub(lambda m: _redaction_marker(m.group(0)), value)
    return value


def _extract_json(raw: str) -> dict:
    raw = (raw or "").strip()

    try:
        value = json.loads(raw)
        return value if isinstance(value, dict) else {"value": value}
    except json.JSONDecodeError:
        pass

    fenced = re.search(
        r"```(?:json)?\s*(\{.*\})\s*```",
        raw,
        flags=re.IGNORECASE | re.DOTALL,
    )
    if fenced:
        try:
            value = json.loads(fenced.group(1))
            return value if isinstance(value, dict) else {"value": value}
        except json.JSONDecodeError:
            pass

    first = raw.find("{")
    last = raw.rfind("}")
    if first != -1 and last > first:
        try:
            value = json.loads(raw[first:last + 1])
            return value if isinstance(value, dict) else {"value": value}
        except json.JSONDecodeError:
            pass

    return {"raw": raw}


async def _chat(system: str, user: str) -> dict:
    base_url, api_key, model = settings.resolved_llm()
    user = redact_for_ai(user)
    url = base_url.rstrip("/") + "/chat/completions"

    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        "temperature": 0.15,
    }

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }

    async with httpx.AsyncClient(timeout=settings.llm_timeout) as client:
        response = await client.post(url, json=payload, headers=headers)
        response.raise_for_status()
        data = response.json()

    try:
        raw = data["choices"][0]["message"]["content"]
    except (KeyError, IndexError, TypeError) as exc:
        raise RuntimeError(
            "AI provider returned an unexpected chat-completions response"
        ) from exc

    return _extract_json(raw)


async def analyze_and_verify(request: str, response: str) -> dict:
    raw = f"HTTP REQUEST\n{request}\n\nHTTP RESPONSE\n{response}"
    analyst = await _chat(ANALYST_SYSTEM, raw)

    verifier_input = (
        "PROPOSED FINDING\n"
        + json.dumps(analyst, ensure_ascii=False)
        + "\n\nRAW EVIDENCE\n"
        + raw
    )
    verifier = await _chat(VERIFIER_SYSTEM, verifier_input)

    if not verifier.get("supported", False):
        analyst["status"] = "suspected"
        analyst["confidence"] = min(
            int(analyst.get("confidence", 0) or 0),
            int(verifier.get("confidence", 0) or 0),
        )

    return {"analyst": analyst, "verifier": verifier}


async def review_source_bundle(repository: str, ref: str, files: dict[str, str]) -> dict:
    sections = []
    for path, content in files.items():
        sections.append(
            f"\n===== FILE: {path} =====\n{content}\n===== END FILE ====="
        )
    prompt = (
        f"REPOSITORY: {repository}\nREF: {ref}\n"
        + "".join(sections)
    )
    return await _chat(CODE_REVIEW_SYSTEM, prompt)


async def verify_retest(original_finding: dict, request: str, response: str) -> dict:
    prompt = (
        "ORIGINAL FINDING\n"
        + json.dumps(original_finding, ensure_ascii=False)
        + "\n\nNEW HTTP REQUEST\n"
        + request
        + "\n\nNEW HTTP RESPONSE\n"
        + response
    )
    return await _chat(RETEST_SYSTEM, prompt)
