# STAR CYBER AI X

Self-hosted AI security workspace for authorized security testing, secure code review, Burp Suite traffic analysis, evidence capture, remediation, retesting, and reporting.

## Included

- FastAPI backend
- OpenAI-compatible LLM adapter
- Analyst + independent verifier workflow
- Project and authorized-scope registry
- Burp request/response analysis endpoint
- Evidence bundles with SHA-256 integrity hashes
- Findings database
- Safe scanner runner for authorized scopes
- HTML security reports
- Mobile-first dark dashboard
- Docker Compose deployment

## Quick start

```bash
cd star-cyber-ai-x
cp .env.example .env
docker compose up --build
```

Open:

- UI: http://localhost:8080
- API docs: http://localhost:8080/docs

## LLM

Set an OpenAI-compatible endpoint in `.env`:

```env
LLM_BASE_URL=http://host.docker.internal:8000/v1
LLM_API_KEY=local
LLM_MODEL=Qwen3-Coder
```

You can point this at vLLM, llama.cpp server, or another compatible endpoint.

## Main endpoints

- `POST /api/projects`
- `POST /api/scopes`
- `POST /api/burp/analyze`
- `POST /api/scans`
- `GET /api/findings`
- `GET /api/reports/{project_id}`

Active tests require an explicitly authorized scope.
