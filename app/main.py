from pathlib import Path
import json
import shlex

from fastapi import Depends, FastAPI, File, HTTPException, UploadFile
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from .config import settings
from .db import init_db, connect, one, all_rows
from .evidence import add_attachment, read_manifest, save_bundle
from .llm import analyze_and_verify
from .reports import render_report
from .scanners import run_scanner
from .security import require_api_token


app = FastAPI(title=settings.app_name, version="0.2.0")


class ProjectCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    description: str = Field(default="", max_length=2000)


class ScopeCreate(BaseModel):
    project_id: int
    name: str = Field(min_length=1, max_length=120)
    target: str = Field(min_length=1, max_length=2048)
    authorized: bool = False
    notes: str = Field(default="", max_length=4000)


class BurpAnalyzeRequest(BaseModel):
    project_id: int
    scope_id: int
    request: str = Field(min_length=1, max_length=500000)
    response: str = Field(default="", max_length=1000000)
    note: str = Field(default="", max_length=4000)


class ScanCreate(BaseModel):
    scope_id: int
    scanner: str


@app.on_event("startup")
def startup():
    init_db()


web_dir = Path(__file__).resolve().parent.parent / "web"
app.mount("/static", StaticFiles(directory=web_dir), name="static")


@app.get("/", response_class=HTMLResponse)
def home():
    return (web_dir / "index.html").read_text(encoding="utf-8")


@app.get("/api/health")
def health():
    return {
        "ok": True,
        "name": settings.app_name,
        "version": app.version,
        "env": settings.app_env,
        "api_auth_configured": bool(settings.api_token),
    }


@app.post("/api/projects", dependencies=[Depends(require_api_token)])
def create_project(data: ProjectCreate):
    with connect() as conn:
        cur = conn.execute(
            "INSERT INTO projects(name,description) VALUES (?,?)",
            (data.name, data.description),
        )
        project_id = cur.lastrowid
    return one("SELECT * FROM projects WHERE id=?", (project_id,))


@app.get("/api/projects", dependencies=[Depends(require_api_token)])
def list_projects():
    return all_rows("SELECT * FROM projects ORDER BY id DESC")


@app.post("/api/scopes", dependencies=[Depends(require_api_token)])
def create_scope(data: ScopeCreate):
    if not one("SELECT id FROM projects WHERE id=?", (data.project_id,)):
        raise HTTPException(404, "Project not found")

    with connect() as conn:
        cur = conn.execute(
            "INSERT INTO scopes(project_id,name,target,authorized,notes) VALUES (?,?,?,?,?)",
            (data.project_id, data.name, data.target, int(data.authorized), data.notes),
        )
        scope_id = cur.lastrowid
    return one("SELECT * FROM scopes WHERE id=?", (scope_id,))


@app.get("/api/scopes", dependencies=[Depends(require_api_token)])
def list_scopes(project_id: int | None = None):
    if project_id:
        return all_rows("SELECT * FROM scopes WHERE project_id=? ORDER BY id DESC", (project_id,))
    return all_rows("SELECT * FROM scopes ORDER BY id DESC")


def require_authorized_scope(scope_id: int):
    scope = one("SELECT * FROM scopes WHERE id=?", (scope_id,))
    if not scope:
        raise HTTPException(404, "Scope not found")
    if not scope["authorized"]:
        raise HTTPException(
            403,
            "Active testing is disabled until this scope is explicitly marked authorized.",
        )
    return scope


@app.post("/api/burp/analyze", dependencies=[Depends(require_api_token)])
async def burp_analyze(data: BurpAnalyzeRequest):
    scope = require_authorized_scope(data.scope_id)
    if scope["project_id"] != data.project_id:
        raise HTTPException(400, "Scope does not belong to this project")

    manifest = save_bundle(data.project_id, data.scope_id, data.request, data.response, data.note)

    try:
        result = await analyze_and_verify(data.request, data.response)
    except Exception as exc:
        raise HTTPException(502, f"LLM analysis failed: {exc}")

    analyst = result["analyst"]
    evidence = {
        "bundle_id": manifest["bundle_id"],
        "verifier": result["verifier"],
        "analyst_evidence": analyst.get("evidence", {}),
        "validation_notes": analyst.get("validation_notes", ""),
    }

    with connect() as conn:
        cur = conn.execute(
            """INSERT INTO findings(
                project_id,scope_id,title,severity,status,confidence,cwe,owasp,
                summary,evidence_json,remediation
            ) VALUES (?,?,?,?,?,?,?,?,?,?,?)""",
            (
                data.project_id,
                data.scope_id,
                str(analyst.get("title", "Burp traffic observation")),
                str(analyst.get("severity", "info")).lower(),
                str(analyst.get("status", "suspected")).lower(),
                int(analyst.get("confidence", 0) or 0),
                analyst.get("cwe"),
                analyst.get("owasp"),
                str(analyst.get("summary", "")),
                json.dumps(evidence, ensure_ascii=False),
                str(analyst.get("remediation", "")),
            ),
        )
        finding_id = cur.lastrowid

    return {
        "finding": one("SELECT * FROM findings WHERE id=?", (finding_id,)),
        "analysis": result,
        "evidence": manifest,
    }


@app.post("/api/evidence/{project_id}/{bundle_id}/attachments", dependencies=[Depends(require_api_token)])
async def upload_evidence_attachment(project_id: int, bundle_id: str, file: UploadFile = File(...)):
    content = await file.read(20_000_001)
    if len(content) > 20_000_000:
        raise HTTPException(413, "Attachment exceeds 20 MB")

    try:
        return add_attachment(
            project_id,
            bundle_id,
            file.filename or "attachment.bin",
            content,
            file.content_type,
        )
    except FileNotFoundError:
        raise HTTPException(404, "Evidence bundle not found")
    except ValueError as exc:
        raise HTTPException(400, str(exc))


@app.get("/api/evidence/{project_id}/{bundle_id}", dependencies=[Depends(require_api_token)])
def evidence_manifest(project_id: int, bundle_id: str):
    try:
        return read_manifest(project_id, bundle_id)
    except FileNotFoundError:
        raise HTTPException(404, "Evidence bundle not found")
    except ValueError as exc:
        raise HTTPException(400, str(exc))


@app.get("/api/findings", dependencies=[Depends(require_api_token)])
def list_findings(project_id: int | None = None):
    if project_id:
        return all_rows("SELECT * FROM findings WHERE project_id=? ORDER BY id DESC", (project_id,))
    return all_rows("SELECT * FROM findings ORDER BY id DESC")


@app.post("/api/scans", dependencies=[Depends(require_api_token)])
async def create_scan(data: ScanCreate):
    scope = require_authorized_scope(data.scope_id)

    if data.scanner not in {"nmap", "nuclei", "zap-baseline"}:
        raise HTTPException(400, "Unsupported scanner")

    with connect() as conn:
        cur = conn.execute(
            "INSERT INTO scan_runs(scope_id,scanner,status,command) VALUES (?,?,?,?)",
            (data.scope_id, data.scanner, "running", ""),
        )
        run_id = cur.lastrowid

    command, output, code = await run_scanner(data.scanner, scope["target"])
    status = "completed" if code == 0 else "completed-with-errors"

    with connect() as conn:
        conn.execute(
            """UPDATE scan_runs
               SET status=?, command=?, output=?, finished_at=CURRENT_TIMESTAMP
               WHERE id=?""",
            (status, shlex.join(command), output[-200000:], run_id),
        )

    return one("SELECT * FROM scan_runs WHERE id=?", (run_id,))


@app.get("/api/scans", dependencies=[Depends(require_api_token)])
def list_scans(scope_id: int | None = None):
    if scope_id:
        return all_rows("SELECT * FROM scan_runs WHERE scope_id=? ORDER BY id DESC", (scope_id,))
    return all_rows("SELECT * FROM scan_runs ORDER BY id DESC")


@app.get("/api/reports/{project_id}", response_class=HTMLResponse, dependencies=[Depends(require_api_token)])
def report(project_id: int):
    project = one("SELECT * FROM projects WHERE id=?", (project_id,))
    if not project:
        raise HTTPException(404, "Project not found")

    findings = all_rows("SELECT * FROM findings WHERE project_id=? ORDER BY id DESC", (project_id,))
    return HTMLResponse(render_report(project, findings))
