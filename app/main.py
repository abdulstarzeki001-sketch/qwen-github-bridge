from contextlib import asynccontextmanager
from pathlib import Path
import json
import shlex

import httpx
from fastapi import Depends, FastAPI, File, HTTPException, UploadFile
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from .burp_tools import compare_exchanges, inspect_exchange
from .config import settings
from .db import init_db, connect, one, all_rows, audit
from .evidence import add_attachment, read_manifest, save_bundle
from .github_intel import GitHubRepositoryClient, validate_repo_name, language_hint
from .llm import analyze_and_verify, review_source_bundle, verify_retest
from .reports import render_report
from .scanners import available_scanners, run_scanner, scanner_available
from .security import require_api_token


@asynccontextmanager
async def lifespan(_: FastAPI):
    init_db()
    yield


app = FastAPI(title=settings.app_name, version="0.7.0", lifespan=lifespan)


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


class BurpExchange(BaseModel):
    request: str = Field(min_length=1, max_length=500000)
    response: str = Field(default="", max_length=1000000)


class BurpCompareRequest(BaseModel):
    first: BurpExchange
    second: BurpExchange


class ScanCreate(BaseModel):
    scope_id: int
    scanner: str


class RepositoryImportRequest(BaseModel):
    project_id: int
    full_name: str = Field(min_length=3, max_length=200)
    ref: str | None = Field(default=None, max_length=200)


class RepositoryAnalyzeRequest(BaseModel):
    paths: list[str] = Field(default_factory=list, max_length=12)


class RetestRequest(BaseModel):
    request: str = Field(min_length=1, max_length=500000)
    response: str = Field(default="", max_length=1000000)
    note: str = Field(default="", max_length=4000)


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
        "github_configured": bool(settings.github_token),
        "ai_provider": settings.ai_provider,
        "ai_model": (
            settings.cloudflare_ai_model
            if settings.ai_provider == "cloudflare"
            else settings.llm_model
        ),
        "ai_configured": (
            bool(settings.cloudflare_account_id and settings.cloudflare_api_token)
            if settings.ai_provider == "cloudflare"
            else bool(settings.llm_base_url and settings.llm_model)
        ),
        "available_scanners": available_scanners(),
    }


@app.post("/api/projects", dependencies=[Depends(require_api_token)])
def create_project(data: ProjectCreate):
    with connect() as conn:
        cur = conn.execute(
            "INSERT INTO projects(name,description) VALUES (?,?)",
            (data.name, data.description),
        )
        project_id = cur.lastrowid
    audit("project.create", "project", str(project_id), {"name": data.name})
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

    audit(
        "scope.create",
        "scope",
        str(scope_id),
        {"project_id": data.project_id, "target": data.target, "authorized": data.authorized},
    )
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

    severity = str(analyst.get("severity", "info")).lower()
    if severity not in {"critical", "high", "medium", "low", "info"}:
        severity = "info"

    status = str(analyst.get("status", "suspected")).lower()
    if status not in {"suspected", "likely", "verified", "fixed", "fix-verified"}:
        status = "suspected"

    confidence = max(0, min(100, int(analyst.get("confidence", 0) or 0)))

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
                severity,
                status,
                confidence,
                analyst.get("cwe"),
                analyst.get("owasp"),
                str(analyst.get("summary", "")),
                json.dumps(evidence, ensure_ascii=False),
                str(analyst.get("remediation", "")),
            ),
        )
        finding_id = cur.lastrowid

    audit(
        "burp.analyze",
        "finding",
        str(finding_id),
        {"scope_id": data.scope_id, "bundle_id": manifest["bundle_id"]},
    )

    return {
        "finding": one("SELECT * FROM findings WHERE id=?", (finding_id,)),
        "analysis": result,
        "evidence": manifest,
    }


@app.post("/api/burp/inspect", dependencies=[Depends(require_api_token)])
def burp_inspect(data: BurpExchange):
    result = inspect_exchange(data.request, data.response)
    audit(
        "burp.inspect",
        "http_exchange",
        "",
        {
            "method": result["request"].get("method"),
            "host": result["request"].get("host"),
            "status": result["response"].get("status"),
        },
    )
    return result


@app.post("/api/burp/compare", dependencies=[Depends(require_api_token)])
def burp_compare(data: BurpCompareRequest):
    result = compare_exchanges(
        data.first.model_dump(),
        data.second.model_dump(),
    )
    audit(
        "burp.compare",
        "http_exchange_pair",
        "",
        {
            "first_status": result["first"]["response"].get("status"),
            "second_status": result["second"]["response"].get("status"),
            "body_similarity": result["differences"].get("response_body_similarity"),
        },
    )
    return result


@app.post("/api/evidence/{project_id}/{bundle_id}/attachments", dependencies=[Depends(require_api_token)])
async def upload_evidence_attachment(project_id: int, bundle_id: str, file: UploadFile = File(...)):
    content = await file.read(20_000_001)
    if len(content) > 20_000_000:
        raise HTTPException(413, "Attachment exceeds 20 MB")

    try:
        result = add_attachment(
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

    audit(
        "evidence.attach",
        "evidence",
        bundle_id,
        {"project_id": project_id, "name": result["name"], "sha256": result["sha256"]},
    )
    return result


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


@app.post("/api/findings/{finding_id}/retest", dependencies=[Depends(require_api_token)])
async def retest_finding(finding_id: int, data: RetestRequest):
    finding = one("SELECT * FROM findings WHERE id=?", (finding_id,))
    if not finding:
        raise HTTPException(404, "Finding not found")
    if not finding.get("scope_id"):
        raise HTTPException(400, "This finding is not associated with an active-test scope")

    scope = require_authorized_scope(int(finding["scope_id"]))
    manifest = save_bundle(
        int(finding["project_id"]),
        int(scope["id"]),
        data.request,
        data.response,
        data.note or f"Retest for finding #{finding_id}",
    )

    try:
        result = await verify_retest(finding, data.request, data.response)
    except Exception as exc:
        raise HTTPException(502, f"LLM retest verification failed: {exc}")

    verdict = str(result.get("verdict", "inconclusive")).lower()
    if verdict not in {"fix-verified", "still-vulnerable", "inconclusive"}:
        verdict = "inconclusive"
    confidence = max(0, min(100, int(result.get("confidence", 0) or 0)))
    rationale = str(result.get("rationale", ""))

    with connect() as conn:
        cur = conn.execute(
            """INSERT INTO retests(finding_id,bundle_id,verdict,confidence,rationale)
               VALUES (?,?,?,?,?)""",
            (finding_id, manifest["bundle_id"], verdict, confidence, rationale),
        )
        retest_id = cur.lastrowid

        if verdict == "fix-verified" and confidence >= 80:
            conn.execute("UPDATE findings SET status='fix-verified' WHERE id=?", (finding_id,))
        elif verdict == "still-vulnerable" and confidence >= 70:
            conn.execute("UPDATE findings SET status='verified' WHERE id=?", (finding_id,))

    audit(
        "finding.retest",
        "finding",
        str(finding_id),
        {
            "retest_id": retest_id,
            "bundle_id": manifest["bundle_id"],
            "verdict": verdict,
            "confidence": confidence,
        },
    )

    return {
        "retest": one("SELECT * FROM retests WHERE id=?", (retest_id,)),
        "finding": one("SELECT * FROM findings WHERE id=?", (finding_id,)),
        "verification": result,
        "evidence": manifest,
    }


@app.get("/api/findings/{finding_id}/retests", dependencies=[Depends(require_api_token)])
def list_retests(finding_id: int):
    if not one("SELECT id FROM findings WHERE id=?", (finding_id,)):
        raise HTTPException(404, "Finding not found")
    return all_rows("SELECT * FROM retests WHERE finding_id=? ORDER BY id DESC", (finding_id,))


@app.post("/api/repositories/import", dependencies=[Depends(require_api_token)])
async def import_repository(data: RepositoryImportRequest):
    if not one("SELECT id FROM projects WHERE id=?", (data.project_id,)):
        raise HTTPException(404, "Project not found")
    if not validate_repo_name(data.full_name):
        raise HTTPException(400, "Repository must be owner/name")

    client = GitHubRepositoryClient()

    try:
        meta = await client.repo_metadata(data.full_name)
        ref = data.ref or str(meta.get("default_branch") or "main")
        files, truncated = await client.tree(data.full_name, ref)
    except ValueError as exc:
        raise HTTPException(400, str(exc))
    except httpx.HTTPStatusError as exc:
        code = exc.response.status_code
        if code == 404:
            raise HTTPException(404, "Repository or ref not found, or token lacks access")
        if code in {401, 403}:
            raise HTTPException(code, "GitHub access denied. Check GITHUB_TOKEN permissions.")
        raise HTTPException(502, f"GitHub API returned HTTP {code}")
    except httpx.HTTPError as exc:
        raise HTTPException(502, f"GitHub request failed: {exc}")

    default_branch = str(meta.get("default_branch") or "main")

    with connect() as conn:
        conn.execute(
            """INSERT INTO repositories(project_id,full_name,ref,default_branch,file_count)
               VALUES (?,?,?,?,?)
               ON CONFLICT(project_id,full_name,ref)
               DO UPDATE SET default_branch=excluded.default_branch,
                             file_count=excluded.file_count,
                             imported_at=CURRENT_TIMESTAMP""",
            (data.project_id, data.full_name, ref, default_branch, len(files)),
        )
        row = conn.execute(
            "SELECT id FROM repositories WHERE project_id=? AND full_name=? AND ref=?",
            (data.project_id, data.full_name, ref),
        ).fetchone()
        repository_id = int(row["id"])

        conn.execute("DELETE FROM repo_files WHERE repository_id=?", (repository_id,))
        conn.executemany(
            """INSERT INTO repo_files(repository_id,path,sha,size,language_hint)
               VALUES (?,?,?,?,?)""",
            [
                (
                    repository_id,
                    str(item.get("path", "")),
                    str(item.get("sha", "")),
                    int(item.get("size", 0) or 0),
                    language_hint(str(item.get("path", ""))),
                )
                for item in files
            ],
        )

    audit(
        "repository.import",
        "repository",
        str(repository_id),
        {
            "project_id": data.project_id,
            "full_name": data.full_name,
            "ref": ref,
            "file_count": len(files),
            "github_tree_truncated": truncated,
        },
    )

    return {
        "repository": one("SELECT * FROM repositories WHERE id=?", (repository_id,)),
        "indexed_files": len(files),
        "github_tree_truncated": truncated,
    }


@app.get("/api/repositories", dependencies=[Depends(require_api_token)])
def list_repositories(project_id: int | None = None):
    if project_id:
        return all_rows(
            "SELECT * FROM repositories WHERE project_id=? ORDER BY imported_at DESC",
            (project_id,),
        )
    return all_rows("SELECT * FROM repositories ORDER BY imported_at DESC")


@app.get("/api/repositories/{repository_id}/files", dependencies=[Depends(require_api_token)])
def list_repository_files(repository_id: int):
    if not one("SELECT id FROM repositories WHERE id=?", (repository_id,)):
        raise HTTPException(404, "Repository import not found")
    return all_rows(
        """SELECT path,sha,size,language_hint
           FROM repo_files WHERE repository_id=? ORDER BY id ASC""",
        (repository_id,),
    )


@app.post("/api/repositories/{repository_id}/analyze", dependencies=[Depends(require_api_token)])
async def analyze_repository(repository_id: int, data: RepositoryAnalyzeRequest):
    repository = one("SELECT * FROM repositories WHERE id=?", (repository_id,))
    if not repository:
        raise HTTPException(404, "Repository import not found")

    indexed = all_rows(
        "SELECT path,size FROM repo_files WHERE repository_id=? ORDER BY id ASC",
        (repository_id,),
    )
    indexed_map = {row["path"]: row for row in indexed}

    if data.paths:
        missing = [path for path in data.paths if path not in indexed_map]
        if missing:
            raise HTTPException(400, f"Paths are not indexed: {', '.join(missing[:3])}")
        selected = data.paths
    else:
        selected = [row["path"] for row in indexed[:8]]

    if not selected:
        raise HTTPException(400, "No reviewable text files were indexed")

    client = GitHubRepositoryClient()
    source_bundle = {}
    total_chars = 0

    try:
        for path in selected[:12]:
            text = await client.file_text(repository["full_name"], path, repository["ref"])
            text = text[:60_000]
            if total_chars + len(text) > 240_000:
                remaining = 240_000 - total_chars
                if remaining <= 0:
                    break
                text = text[:remaining]
            source_bundle[path] = text
            total_chars += len(text)
    except ValueError as exc:
        raise HTTPException(400, str(exc))
    except httpx.HTTPStatusError as exc:
        raise HTTPException(502, f"GitHub API returned HTTP {exc.response.status_code}")
    except httpx.HTTPError as exc:
        raise HTTPException(502, f"GitHub request failed: {exc}")

    if not source_bundle:
        raise HTTPException(400, "No source content available for review")

    try:
        review = await review_source_bundle(
            repository["full_name"],
            repository["ref"],
            source_bundle,
        )
    except Exception as exc:
        raise HTTPException(502, f"LLM code review failed: {exc}")

    saved_ids = []
    findings = review.get("findings", [])
    if isinstance(findings, list):
        with connect() as conn:
            for item in findings[:30]:
                if not isinstance(item, dict):
                    continue

                severity = str(item.get("severity", "info")).lower()
                if severity not in {"critical", "high", "medium", "low", "info"}:
                    severity = "info"
                confidence = max(0, min(100, int(item.get("confidence", 0) or 0)))
                status = "likely" if confidence >= 80 else "suspected"
                file_path = str(item.get("file", ""))

                evidence = {
                    "source": "repository-code-review",
                    "repository_id": repository_id,
                    "repository": repository["full_name"],
                    "ref": repository["ref"],
                    "file": file_path,
                    "code_evidence": item.get("evidence", ""),
                }

                cur = conn.execute(
                    """INSERT INTO findings(
                        project_id,scope_id,title,severity,status,confidence,cwe,owasp,
                        summary,evidence_json,remediation
                    ) VALUES (?,NULL,?,?,?,?,?,?,?,?,?)""",
                    (
                        repository["project_id"],
                        str(item.get("title", "Code review finding")),
                        severity,
                        status,
                        confidence,
                        item.get("cwe"),
                        item.get("owasp"),
                        str(item.get("summary", "")),
                        json.dumps(evidence, ensure_ascii=False),
                        str(item.get("remediation", "")),
                    ),
                )
                saved_ids.append(cur.lastrowid)

    audit(
        "repository.analyze",
        "repository",
        str(repository_id),
        {
            "paths": list(source_bundle.keys()),
            "chars_reviewed": total_chars,
            "saved_findings": saved_ids,
        },
    )

    return {
        "repository": repository,
        "files_reviewed": list(source_bundle.keys()),
        "chars_reviewed": total_chars,
        "review": review,
        "saved_finding_ids": saved_ids,
    }


@app.post("/api/scans", dependencies=[Depends(require_api_token)])
async def create_scan(data: ScanCreate):
    scope = require_authorized_scope(data.scope_id)

    if data.scanner not in {"nmap", "nuclei", "zap-baseline"}:
        raise HTTPException(400, "Unsupported scanner")
    if not scanner_available(data.scanner):
        raise HTTPException(
            503,
            f"{data.scanner} is not installed in this runtime. "
            "Use a runner image that includes it before enabling this scanner.",
        )

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

    audit(
        "scan.run",
        "scan_run",
        str(run_id),
        {"scope_id": data.scope_id, "scanner": data.scanner, "status": status},
    )
    return one("SELECT * FROM scan_runs WHERE id=?", (run_id,))


@app.get("/api/scans", dependencies=[Depends(require_api_token)])
def list_scans(scope_id: int | None = None):
    if scope_id:
        return all_rows("SELECT * FROM scan_runs WHERE scope_id=? ORDER BY id DESC", (scope_id,))
    return all_rows("SELECT * FROM scan_runs ORDER BY id DESC")


@app.get("/api/audit", dependencies=[Depends(require_api_token)])
def list_audit(limit: int = 100):
    limit = max(1, min(500, limit))
    return all_rows("SELECT * FROM audit_log ORDER BY id DESC LIMIT ?", (limit,))


@app.get("/api/reports/{project_id}", response_class=HTMLResponse, dependencies=[Depends(require_api_token)])
def report(project_id: int):
    project = one("SELECT * FROM projects WHERE id=?", (project_id,))
    if not project:
        raise HTTPException(404, "Project not found")

    findings = all_rows("SELECT * FROM findings WHERE project_id=? ORDER BY id DESC", (project_id,))
    return HTMLResponse(render_report(project, findings))


@app.get("/api/reports/{project_id}/json", dependencies=[Depends(require_api_token)])
def report_json(project_id: int):
    project = one("SELECT * FROM projects WHERE id=?", (project_id,))
    if not project:
        raise HTTPException(404, "Project not found")

    findings = all_rows("SELECT * FROM findings WHERE project_id=? ORDER BY id DESC", (project_id,))
    repositories = all_rows(
        "SELECT * FROM repositories WHERE project_id=? ORDER BY imported_at DESC",
        (project_id,),
    )

    return JSONResponse(
        {
            "project": project,
            "findings": findings,
            "repositories": repositories,
        }
    )
