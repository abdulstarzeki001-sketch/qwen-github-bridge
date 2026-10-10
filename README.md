# STAR CYBER AI X

**Self-hosted AI security workspace** for authorized application-security testing, Burp Suite traffic analysis, repository security review, evidence management, remediation, retesting, and reporting.

> The previous Qwen GitHub Bridge is preserved under `legacy/qwen-github-bridge/`.

## Architecture

```text
Burp Suite / Browser / iPhone / GitHub
               |
               v
         STAR CYBER AI X API
               |
   +-----------+-----------+----------------+
   |                       |                |
   v                       v                v
LLM Analyst             Verifier       Evidence Store
   |                       |                |
   +------> Findings <------+----------------+
              |
              +--> Retest history
              +--> HTML / JSON reports
              +--> Authorized scanner runner
              +--> Repository Intelligence
```

## Features

- OpenAI-compatible LLM adapter for self-hosted models
- Analyst + independent verifier workflow
- Burp Suite Montoya extension with **Analyze**, **Passive Inspect**, and **Compare 2 selected** actions
- **GitHub Repository Intelligence** for read-only source indexing and AI-assisted secure-code review
- **Finding retest workflow** with `fix-verified / still-vulnerable / inconclusive`
- Explicit project/scope authorization gate
- Evidence bundles with SHA-256 integrity hashes
- Evidence attachments for screenshots, HAR, JSON, PCAP, text, and related artifacts
- Findings database with severity, status, confidence, CWE, OWASP, evidence, and remediation
- Audit log for security-relevant platform actions
- Controlled scanner runner
- Printable HTML + machine-readable JSON reports
- Mobile-first control dashboard
- Docker / Docker Compose
- GitHub Actions CI
- Automatic GHCR container publishing from `main`
- Optional deployment webhook
- Dependabot for Python, Maven, and GitHub Actions

## Quick start

```bash
cp .env.example .env
# edit .env and set STAR_API_TOKEN
docker compose up --build
```

Open:

- Dashboard: http://localhost:8080
- API docs: http://localhost:8080/docs
- Health: http://localhost:8080/api/health

Protected API endpoints require:

```http
Authorization: Bearer <STAR_API_TOKEN>
```

## AI brain

The recommended **free starting provider** is Cloudflare Workers AI:

```env
AI_PROVIDER=cloudflare
CLOUDFLARE_ACCOUNT_ID=...
CLOUDFLARE_API_TOKEN=...
CLOUDFLARE_AI_MODEL=@cf/qwen/qwen3.8-27b
```

STAR calls Cloudflare through its OpenAI-compatible Chat Completions endpoint.

Later, you can switch to a private GPU without changing the rest of STAR:

```env
AI_PROVIDER=self_hosted
LLM_BASE_URL=https://your-private-model.example/v1
LLM_API_KEY=...
LLM_MODEL=...
```

See `docs/FREE_AI_BRAIN.md`.

## GitHub Repository Intelligence

For private repositories, configure a fine-grained read-only token:

```env
GITHUB_TOKEN=...
```

Recommended GitHub permissions on selected repositories:

- Metadata: Read
- Contents: Read

Import a repository:

```http
POST /api/repositories/import
```

Then review selected indexed files:

```http
POST /api/repositories/{repository_id}/analyze
```

Static-review findings are saved as `suspected` or `likely`; the platform does not claim runtime exploitation from source review alone.

## Burp Suite

```bash
mvn -B -f burp-extension/pom.xml clean package
```

Load `burp-extension/target/star-burp-ai-0.2.0.jar` into Burp, configure the **STAR AI** tab, then right-click a request/response and select **Analyze with STAR AI**.

## Retesting

A Burp/API finding tied to an authorized scope can be retested with:

```http
POST /api/findings/{finding_id}/retest
```

The original finding is only promoted to `fix-verified` when the independent retest verifier has clear equivalent evidence and confidence of at least 80%.

## Security testing model

Active testing only runs for targets registered in a scope with `authorized=true`. The default scanner profile is non-destructive.

## CI / deployment

Pull requests test Python, compile the Burp extension, publish the JAR as a CI artifact, and build the Docker image. Pushes to `main` publish:

```text
ghcr.io/abdulstarzeki001-sketch/qwen-github-bridge:latest
```

If `DEPLOY_WEBHOOK_URL` is configured as a repository secret, the publish workflow calls it after a successful image push.

See `docs/` for deployment, Burp integration, repository intelligence, security model, and roadmap.


## AI provider status

GitHub Models inference was fully retired by GitHub on July 30, 2026, so STAR no longer uses that endpoint.

For the always-on AI brain, the current free-start path is **Cloudflare Workers AI**. GitHub continues to handle source control, CI, Burp extension builds, GHCR publishing, repository intelligence, and release history.

The Cloudflare adapter and connectivity test are already included; activation requires the Cloudflare account ID and scoped Workers AI API token to be stored as secrets, never committed to the repository.
