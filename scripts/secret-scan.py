#!/usr/bin/env python3
"""Local, read-only secret scanner. Findings never include matched secret values."""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import sys
from pathlib import Path

MAX_FILE_BYTES = 2 * 1024 * 1024
SKIP_DIRS = {
    ".git", ".hg", ".svn", ".venv", "venv", "node_modules", "__pycache__",
    ".next", ".nuxt", "dist", "build", "target", ".integrations",
}
SKIP_PREFIXES = ("integrations/upstreams/",)
SKIP_SUFFIXES = {
    ".png", ".jpg", ".jpeg", ".gif", ".webp", ".ico", ".pdf", ".zip", ".gz",
    ".tar", ".woff", ".woff2", ".ttf", ".otf", ".mp4", ".mov", ".sqlite",
    ".db", ".jar", ".class", ".pyc", ".so", ".dylib", ".dll", ".exe",
}

PATTERNS: tuple[tuple[str, re.Pattern[str]], ...] = (
    ("GitHub fine-grained token", re.compile(r"\bgithub_pat_[A-Za-z0-9_]{40,}\b")),
    ("GitHub access token", re.compile(r"\bgh[pousr]_[A-Za-z0-9]{30,}\b")),
    ("AWS access key ID", re.compile(r"\bAKIA[0-9A-Z]{16}\b")),
    ("Slack token", re.compile(r"\bxox[baprs]-[A-Za-z0-9-]{20,}\b")),
    ("Google API key", re.compile(r"\bAIza[0-9A-Za-z_-]{35}\b")),
    ("Stripe live secret", re.compile(r"\b(?:sk|rk)_live_[A-Za-z0-9]{16,}\b")),
    ("Private key material", re.compile(r"-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----")),
    (
        "Hard-coded credential assignment",
        re.compile(
            r"""(?i)\b(?:api[_-]?key|access[_-]?token|auth[_-]?token|secret(?:[_-]?key)?|client[_-]?secret|password)\b\s*[:=]\s*["']([A-Za-z0-9/+_.=-]{20,})["']"""
        ),
    ),
)
PLACEHOLDER = re.compile(
    r"(?i)^(?:your[_-]|change[_-]?me|replace[_-]?me|example|sample|dummy|placeholder|test[_-]|xxx+|\*+|<[^>]+>)"
)


def classify(line: str) -> list[str]:
    found: list[str] = []
    for label, pattern in PATTERNS:
        matches = pattern.finditer(line)
        if label == "Hard-coded credential assignment":
            for match in matches:
                value = match.group(1).rstrip(".,;")
                if not PLACEHOLDER.search(value):
                    found.append(label)
                    break
        elif pattern.search(line):
            found.append(label)
    return found


def scan(root: Path) -> tuple[list[dict[str, object]], int, int]:
    findings: list[dict[str, object]] = []
    scanned = 0
    skipped_large = 0
    root = root.resolve()

    for current, dirs, files in os.walk(root, followlinks=False):
        current_path = Path(current)
        dirs[:] = [
            name for name in dirs
            if name not in SKIP_DIRS and not (current_path / name).is_symlink()
        ]
        for name in files:
            path = current_path / name
            if path.is_symlink() or path.suffix.lower() in SKIP_SUFFIXES:
                continue
            relative = path.relative_to(root).as_posix()
            if any(relative.startswith(prefix) for prefix in SKIP_PREFIXES):
                continue
            try:
                if path.stat().st_size > MAX_FILE_BYTES:
                    skipped_large += 1
                    continue
                text = path.read_text(encoding="utf-8", errors="replace")
            except OSError:
                continue

            scanned += 1
            for number, line in enumerate(text.splitlines(), start=1):
                for category in classify(line):
                    stable_id = hashlib.sha256(
                        f"{relative}:{number}:{category}".encode("utf-8")
                    ).hexdigest()[:12]
                    findings.append(
                        {
                            "file": relative,
                            "line": number,
                            "category": category,
                            "finding_id": stable_id,
                        }
                    )
    return findings, scanned, skipped_large


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Scan a local source tree for likely exposed credentials. Values are never printed."
    )
    parser.add_argument("path", nargs="?", default=".", help="directory to scan (default: current directory)")
    parser.add_argument("--json", action="store_true", help="emit a machine-readable redacted report")
    args = parser.parse_args()

    root = Path(args.path)
    if not root.is_dir():
        print("Error: scan path must be an existing directory.", file=sys.stderr)
        return 2

    findings, scanned, skipped_large = scan(root)
    if args.json:
        print(json.dumps(
            {"scanned_files": scanned, "skipped_large_files": skipped_large, "findings": findings},
            ensure_ascii=False,
            indent=2,
        ))
    else:
        print(f"Scanned {scanned} text files; skipped {skipped_large} files larger than 2 MiB.")
        for item in findings:
            print(
                f"{item['file']}:{item['line']}  {item['category']}  "
                f"[finding {item['finding_id']}]"
            )
        print(f"Findings: {len(findings)} (secret values are never displayed).")

    return 1 if findings else 0


if __name__ == "__main__":
    raise SystemExit(main())
