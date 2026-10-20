import json
import re

import httpx

from .config import settings
from .redaction import redact_http_message, redact_source_text


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
    safe_request = redact_http_message(request)
    safe_response = redact_http_message(response)
    raw = f"HTTP REQUEST\n{safe_request}\n\nHTTP RESPONSE\n{safe_response}"
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
        safe_content = redact_source_text(content)
        sections.append(
            f"\n===== FILE: {path} =====\n{safe_content}\n===== END FILE ====="
        )
    prompt = (
        f"REPOSITORY: {repository}\nREF: {ref}\n"
        + "".join(sections)
    )
    return await _chat(CODE_REVIEW_SYSTEM, prompt)


async def verify_retest(original_finding: dict, request: str, response: str) -> dict:
    safe_request = redact_http_message(request)
    safe_response = redact_http_message(response)
    prompt = (
        "ORIGINAL FINDING\n"
        + json.dumps(original_finding, ensure_ascii=False)
        + "\n\nNEW HTTP REQUEST\n"
        + safe_request
        + "\n\nNEW HTTP RESPONSE\n"
        + safe_response
    )
    return await _chat(RETEST_SYSTEM, prompt)
