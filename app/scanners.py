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


def host_from_target(target: str) -> str:
    parsed = urlparse(target if "://" in target else f"//{target}", scheme="")
    return parsed.hostname or target.split("/")[0].split(":")[0]


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
