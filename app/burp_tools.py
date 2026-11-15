import base64
import json
from difflib import SequenceMatcher
from urllib.parse import parse_qs, urlsplit


SECURITY_HEADERS = {
    "strict-transport-security": "HSTS",
    "content-security-policy": "CSP",
    "x-content-type-options": "X-Content-Type-Options",
    "referrer-policy": "Referrer-Policy",
    "permissions-policy": "Permissions-Policy",
}


def _split_message(raw: str):
    normalized = raw.replace("\r\n", "\n")
    head, sep, body = normalized.partition("\n\n")
    lines = head.split("\n") if head else []
    start = lines[0] if lines else ""
    headers = []
    for line in lines[1:]:
        if ":" not in line:
            continue
        name, value = line.split(":", 1)
        headers.append((name.strip(), value.strip()))
    return start, headers, body if sep else ""


def _header_map(headers):
    out = {}
    for name, value in headers:
        out.setdefault(name.lower(), []).append(value)
    return out


def _first(headers, name: str):
    values = headers.get(name.lower(), [])
    return values[0] if values else None


def _decode_b64url_json(part: str):
    try:
        padding = "=" * ((4 - len(part) % 4) % 4)
        raw = base64.urlsafe_b64decode((part + padding).encode())
        value = json.loads(raw.decode("utf-8"))
        return value if isinstance(value, dict) else {"value": value}
    except Exception:
        return None


def inspect_jwt(token: str):
    parts = token.split(".")
    if len(parts) != 3:
        return {"jwt_like": False}

    header = _decode_b64url_json(parts[0])
    payload = _decode_b64url_json(parts[1])
    if header is None or payload is None:
        return {"jwt_like": False}

    observations = []
    alg = str(header.get("alg", ""))
    if alg.lower() == "none":
        observations.append("JWT header declares alg=none.")
    if "exp" not in payload:
        observations.append("JWT payload has no exp claim.")

    return {
        "jwt_like": True,
        "header": header,
        "claims": {
            key: payload.get(key)
            for key in ("iss", "sub", "aud", "exp", "iat", "nbf", "jti")
            if key in payload
        },
        "observations": observations,
    }


def _cookie_observations(set_cookie_values):
    cookies = []
    for raw in set_cookie_values:
        parts = [p.strip() for p in raw.split(";") if p.strip()]
        if not parts or "=" not in parts[0]:
            continue
        name = parts[0].split("=", 1)[0]
        attrs = {p.lower() for p in parts[1:]}
        same_site = next((p for p in parts[1:] if p.lower().startswith("samesite=")), None)
        cookies.append(
            {
                "name": name,
                "secure": "secure" in attrs,
                "http_only": "httponly" in attrs,
                "same_site": same_site.split("=", 1)[1] if same_site and "=" in same_site else None,
            }
        )
    return cookies


def inspect_exchange(request: str, response: str):
    req_start, req_headers_list, req_body = _split_message(request)
    res_start, res_headers_list, res_body = _split_message(response)

    req_headers = _header_map(req_headers_list)
    res_headers = _header_map(res_headers_list)

    method = None
    target = None
    req_parts = req_start.split(" ")
    if len(req_parts) >= 2:
        method, target = req_parts[0], req_parts[1]

    status = None
    res_parts = res_start.split(" ")
    if len(res_parts) >= 2 and res_parts[1].isdigit():
        status = int(res_parts[1])

    parsed_target = urlsplit(target or "")
    query_keys = sorted(parse_qs(parsed_target.query, keep_blank_values=True).keys())

    auth = _first(req_headers, "authorization")
    auth_info = {"present": bool(auth), "scheme": None, "jwt": None}
    if auth:
        scheme, _, credential = auth.partition(" ")
        auth_info["scheme"] = scheme
        if scheme.lower() == "bearer" and credential:
            auth_info["jwt"] = inspect_jwt(credential)

    request_cookie = _first(req_headers, "cookie") or ""
    request_cookie_names = []
    for part in request_cookie.split(";"):
        if "=" in part:
            request_cookie_names.append(part.split("=", 1)[0].strip())

    present_security_headers = {
        label: bool(_first(res_headers, header))
        for header, label in SECURITY_HEADERS.items()
    }

    csp = _first(res_headers, "content-security-policy") or ""
    xfo = _first(res_headers, "x-frame-options")
    clickjacking_control = bool(xfo or "frame-ancestors" in csp.lower())

    observations = []
    if response:
        if not present_security_headers["X-Content-Type-Options"]:
            observations.append("Response does not include X-Content-Type-Options.")
        if not clickjacking_control:
            observations.append("No X-Frame-Options or CSP frame-ancestors observed.")
        if parsed_target.scheme == "https" and not present_security_headers["HSTS"]:
            observations.append("HTTPS response has no Strict-Transport-Security header.")

    return {
        "request": {
            "start_line": req_start,
            "method": method,
            "target": target,
            "host": _first(req_headers, "host"),
            "query_keys": query_keys,
            "cookie_names": sorted(set(request_cookie_names)),
            "body_length": len(req_body.encode("utf-8", errors="replace")),
            "authorization": auth_info,
        },
        "response": {
            "start_line": res_start,
            "status": status,
            "content_type": _first(res_headers, "content-type"),
            "body_length": len(res_body.encode("utf-8", errors="replace")),
            "security_headers": present_security_headers,
            "clickjacking_control": clickjacking_control,
            "set_cookies": _cookie_observations(res_headers.get("set-cookie", [])),
        },
        "observations": observations,
    }


def compare_exchanges(first: dict, second: dict):
    a = inspect_exchange(first.get("request", ""), first.get("response", ""))
    b = inspect_exchange(second.get("request", ""), second.get("response", ""))

    _, a_headers_list, a_body = _split_message(first.get("response", ""))
    _, b_headers_list, b_body = _split_message(second.get("response", ""))
    a_headers = _header_map(a_headers_list)
    b_headers = _header_map(b_headers_list)

    all_header_names = sorted(set(a_headers) | set(b_headers))
    changed_headers = []
    for name in all_header_names:
        av = a_headers.get(name, [])
        bv = b_headers.get(name, [])
        if av != bv:
            changed_headers.append({"name": name, "first": av, "second": bv})

    similarity = SequenceMatcher(
        None,
        a_body[:100_000],
        b_body[:100_000],
        autojunk=True,
    ).ratio()

    return {
        "first": a,
        "second": b,
        "differences": {
            "request_method_changed": a["request"]["method"] != b["request"]["method"],
            "request_target_changed": a["request"]["target"] != b["request"]["target"],
            "status_changed": a["response"]["status"] != b["response"]["status"],
            "body_length_delta": b["response"]["body_length"] - a["response"]["body_length"],
            "response_body_similarity": round(similarity, 4),
            "changed_response_headers": changed_headers[:50],
        },
    }
