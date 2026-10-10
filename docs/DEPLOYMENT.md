# Deployment

## Local / private server

```bash
cp .env.example .env
docker compose up -d --build
```

Set a strong `STAR_API_TOKEN` before exposing the service.

## GitHub Container Registry

Every push to `main` runs `.github/workflows/publish.yml` and publishes:

```text
ghcr.io/abdulstarzeki001-sketch/qwen-github-bridge:latest
ghcr.io/abdulstarzeki001-sketch/qwen-github-bridge:<commit-sha>
```

The workflow uses GitHub's built-in `GITHUB_TOKEN` with `packages: write`.

## Automatic deployment hook

If your server or hosting provider supports deployment webhooks, create the repository secret:

```text
DEPLOY_WEBHOOK_URL
```

After a successful image push, GitHub Actions sends an HTTP POST request to this URL. No deployment credential is committed to the repository.

## GPU / model server

The application itself can run without a GPU. Point it to a separate OpenAI-compatible inference endpoint:

```env
LLM_BASE_URL=https://your-private-llm.example/v1
LLM_API_KEY=...
LLM_MODEL=...
```

Recommended production controls:

- HTTPS
- identity/IP restrictions
- rate limits
- request-size limits
- persistent backups for `/data`
- separate model and API credentials
