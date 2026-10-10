import json
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


async def _chat(system: str, user: str) -> dict:
    url = settings.llm_base_url.rstrip("/") + "/chat/completions"
    payload = {
        "model": settings.llm_model,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        "temperature": 0.15,
        "response_format": {"type": "json_object"},
    }
    headers = {"Authorization": f"Bearer {settings.llm_api_key}"}
    async with httpx.AsyncClient(timeout=settings.llm_timeout) as client:
        response = await client.post(url, json=payload, headers=headers)
        response.raise_for_status()
        raw = response.json()["choices"][0]["message"]["content"]
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return {"raw": raw}


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
