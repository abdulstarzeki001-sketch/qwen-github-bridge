# Repository Intelligence

Repository Intelligence is the read-only source-analysis layer of STAR CYBER AI X.

## Goals

- map a project's reviewable source files,
- prioritize security-sensitive code,
- read selected files directly from GitHub,
- perform evidence-based secure-code review,
- save code-review findings into the same finding/report system.

## GitHub token

Public repositories can be read without a token, subject to GitHub API limits.

Private repositories require `GITHUB_TOKEN`. Use a fine-grained token restricted to the repositories you want STAR CYBER AI X to inspect.

Recommended permissions:

- Metadata: Read
- Contents: Read

Write permissions are not needed for repository intelligence.

## Import

```http
POST /api/repositories/import
Authorization: Bearer <STAR_API_TOKEN>
Content-Type: application/json

{
  "project_id": 1,
  "full_name": "owner/repository",
  "ref": "main"
}
```

The importer indexes text-like files up to 250 KB and stores only metadata:

- path
- Git blob SHA
- size
- language hint

It does not mirror the repository contents into SQLite.

## Analyze

```http
POST /api/repositories/1/analyze
Authorization: Bearer <STAR_API_TOKEN>
Content-Type: application/json

{
  "paths": [
    "app/auth.py",
    "app/routes.py"
  ]
}
```

If `paths` is empty, STAR selects a small high-priority set based on names such as auth, login, session, token, security, permissions, routes, middleware, and API.

Limits per review:

- maximum 12 files,
- maximum 60,000 characters per file,
- maximum 240,000 characters total.

## Finding confidence

Repository review is static analysis. Therefore saved findings use:

- `likely` when confidence is at least 80,
- `suspected` otherwise.

Source review alone does not create a `verified` runtime finding.

Runtime verification belongs in an authorized test scope using Burp or another controlled validation path.
