from datetime import datetime, timezone
from pathlib import Path
import hashlib
import json
import re
import uuid

from .config import settings


BUNDLE_RE = re.compile(r"^[A-Za-z0-9._-]{1,128}$")


def _bundle_dir(project_id: int, bundle_id: str) -> Path:
    if project_id < 1 or not BUNDLE_RE.fullmatch(bundle_id):
        raise ValueError("Invalid evidence bundle identifier")

    root = Path(settings.evidence_dir).resolve()
    base = (root / str(project_id) / bundle_id).resolve()

    if root not in base.parents:
        raise ValueError("Invalid evidence path")

    return base


def save_bundle(project_id: int, scope_id: int, request: str, response: str, note: str = ""):
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    bundle_id = f"{timestamp}-{uuid.uuid4().hex[:8]}"
    base = _bundle_dir(project_id, bundle_id)
    base.mkdir(parents=True, exist_ok=True)

    (base / "request.txt").write_text(request, encoding="utf-8")
    (base / "response.txt").write_text(response, encoding="utf-8")

    manifest = {
        "bundle_id": bundle_id,
        "project_id": project_id,
        "scope_id": scope_id,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "note": note,
        "request_sha256": hashlib.sha256(request.encode()).hexdigest(),
        "response_sha256": hashlib.sha256(response.encode()).hexdigest(),
        "files": [
            {"name": "request.txt", "kind": "http-request"},
            {"name": "response.txt", "kind": "http-response"},
        ],
    }

    (base / "manifest.json").write_text(
        json.dumps(manifest, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )
    return manifest


def add_attachment(project_id: int, bundle_id: str, filename: str, content: bytes, content_type: str | None):
    base = _bundle_dir(project_id, bundle_id)
    manifest_path = base / "manifest.json"

    if not manifest_path.exists():
        raise FileNotFoundError("Evidence bundle not found")

    safe_name = Path(filename).name.strip()
    if not safe_name or safe_name in {".", ".."} or len(safe_name) > 180:
        raise ValueError("Invalid attachment filename")

    attachment_dir = base / "attachments"
    attachment_dir.mkdir(parents=True, exist_ok=True)

    destination = attachment_dir / safe_name
    if destination.exists():
        destination = attachment_dir / f"{destination.stem}-{uuid.uuid4().hex[:8]}{destination.suffix}"

    destination.write_bytes(content)
    digest = hashlib.sha256(content).hexdigest()

    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    manifest.setdefault("files", []).append(
        {
            "name": f"attachments/{destination.name}",
            "kind": "attachment",
            "content_type": content_type or "application/octet-stream",
            "sha256": digest,
            "size": len(content),
        }
    )
    manifest_path.write_text(
        json.dumps(manifest, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )

    return {
        "name": destination.name,
        "size": len(content),
        "sha256": digest,
        "content_type": content_type or "application/octet-stream",
    }


def read_manifest(project_id: int, bundle_id: str):
    path = _bundle_dir(project_id, bundle_id) / "manifest.json"
    if not path.exists():
        raise FileNotFoundError("Evidence bundle not found")
    return json.loads(path.read_text(encoding="utf-8"))
