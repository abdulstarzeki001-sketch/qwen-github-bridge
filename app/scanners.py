import asyncio
import shutil
from urllib.parse import urlparse

from .config import settings


ALLOWED_SCANNERS = {"nmap", "nuclei", "zap-baseline"}
SCANNER_BINARIES = {
    "nmap": "nmap",
    "nuclei": "nuclei",
    "zap-baseline": "zap-baseline.py",
}


def scanner_available(scanner: str) -> bool:
    binary = SCANNER_BINARIES.get(scanner)
    return bool(binary and shutil.which(binary))


def available_scanners() -> list[str]:
    return sorted(scanner for scanner in ALLOWED_SCANNERS if scanner_available(scanner))


def validate_scope_target(target: str) -> str:
    value = (target or "").strip()
    if not value or any(ord(ch) < 32 for ch in value) or any(ch.isspace() for ch in value):
        raise ValueError("Scope target must be a non-empty URL or host without whitespace")

    parsed = urlparse(value if "://" in value else f"//{value}", scheme="")
    if parsed.scheme and parsed.scheme.lower() not in {"http", "https"}:
        raise ValueError("Scope target scheme must be http or https")
    if parsed.username or parsed.password:
        raise ValueError("Scope target must not contain embedded credentials")
    if not parsed.hostname:
        raise ValueError("Scope target must include a hostname or IP address")
    try:
        _ = parsed.port
    except ValueError as exc:
        raise ValueError("Scope target has an invalid port") from exc
    if parsed.fragment:
        raise ValueError("Scope target must not include a URL fragment")
    if not parsed.scheme and (parsed.path not in {"", "/"} or parsed.query):
        raise ValueError("Bare scope targets must be host[:port] only")
    return value


def host_from_target(target: str) -> str:
    value = validate_scope_target(target)
    parsed = urlparse(value if "://" in value else f"//{value}", scheme="")
    return parsed.hostname or ""


def build_command(scanner: str, target: str) -> list[str]:
    host = host_from_target(target)

    if scanner == "nmap":
        return [
            "nmap", "-Pn", "-sT", "-sV", "--version-light",
            "--top-ports", "100", host,
        ]

    if scanner == "nuclei":
        return [
            "nuclei", "-u", target,
            "-severity", "info,low,medium,high,critical",
            "-rl", str(settings.nuclei_rate_limit),
            "-timeout", "8",
            "-retries", "1",
            "-no-interactsh",
            "-jsonl",
        ]

    if scanner == "zap-baseline":
        return ["zap-baseline.py", "-t", target, "-m", "2", "-I"]

    raise ValueError("Unsupported scanner")


async def run_scanner(scanner: str, target: str):
    if scanner not in ALLOWED_SCANNERS:
        raise ValueError("Unsupported scanner")

    cmd = build_command(scanner, target)

    try:
        proc = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.STDOUT,
        )
    except FileNotFoundError:
        return cmd, f"{scanner} is not installed in this image yet.", 127

    try:
        output, _ = await asyncio.wait_for(proc.communicate(), timeout=180)
    except asyncio.TimeoutError:
        proc.kill()
        output, _ = await proc.communicate()
        return cmd, output.decode(errors="replace") + "\n[timeout]", 124

    return cmd, output.decode(errors="replace"), proc.returncode
