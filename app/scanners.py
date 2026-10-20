import asyncio
from urllib.parse import urlparse

from .config import settings


ALLOWED_SCANNERS = {"nmap", "nuclei", "zap-baseline"}


def _clean_target(target: str) -> str:
    value = (target or "").strip()
    if not value or len(value) > 2048:
        raise ValueError("Invalid target")
    if any(ord(ch) < 32 or ord(ch) == 127 for ch in value):
        raise ValueError("Target contains control characters")
    return value


def host_from_target(target: str) -> str:
    value = _clean_target(target)
    parsed = urlparse(value if "://" in value else f"//{value}", scheme="")
    if parsed.username or parsed.password:
        raise ValueError("Credentials in target URLs are not allowed")
    host = parsed.hostname
    if not host:
        raise ValueError("Target hostname is missing")
    return host


def validate_scanner_target(scanner: str, target: str) -> str:
    value = _clean_target(target)
    parsed = urlparse(value)
    if scanner in {"nuclei", "zap-baseline"} and parsed.scheme and parsed.scheme not in {"http", "https"}:
        raise ValueError("Web scanners require an http or https target")
    host_from_target(value)
    return value


def build_command(scanner: str, target: str) -> list[str]:
    target = validate_scanner_target(scanner, target)
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
