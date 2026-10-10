from datetime import datetime, timezone
from pathlib import Path
import hashlib
import json
import uuid

from .config import settings


def save_bundle(project_id: int, scope_id: int, request: str, response: str, note: str = ""):
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    bundle_id = f"{timestamp}-{uuid.uuid4().hex[:8]}"
    base = Path(settings.evidence_dir) / str(project_id) / bundle_id
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
        "files": ["request.txt", "response.txt"],
    }
    (base / "manifest.json").write_text(
        json.dumps(manifest, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )
    return manifest
