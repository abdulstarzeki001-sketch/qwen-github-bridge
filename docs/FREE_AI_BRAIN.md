# Free AI Brain — Cloudflare Workers AI

STAR CYBER AI X uses Cloudflare Workers AI as the recommended free starting brain.

## Why this is the best free option

- It is an API service, not a temporary notebook session.
- STAR can call it directly through an OpenAI-compatible endpoint.
- No GPU setup, CUDA installation, or model download is required.
- Cloudflare includes a daily free Workers AI allocation.
- You can switch later to a private GPU server without changing the rest of STAR.

Default model:

```text
@cf/meta/llama-3.1-8b-instruct
```

## Required environment values

```env
AI_PROVIDER=cloudflare
CLOUDFLARE_ACCOUNT_ID=...
CLOUDFLARE_API_TOKEN=...
CLOUDFLARE_AI_MODEL=@cf/meta/llama-3.1-8b-instruct
```

STAR resolves this automatically to:

```text
https://api.cloudflare.com/client/v4/accounts/<ACCOUNT_ID>/ai/v1/chat/completions
```

## Cloudflare API token

Create a scoped Cloudflare API token for Workers AI. Do not use the Global API Key and do not commit the token to Git.

For a custom token, grant the Workers AI permissions required by Cloudflare's REST API documentation. Keep the token only in deployment secrets or the runtime environment.

## Switch to private GPU later

```env
AI_PROVIDER=self_hosted
LLM_BASE_URL=https://your-private-model.example/v1
LLM_API_KEY=...
LLM_MODEL=...
```

The Burp, repository, evidence, retest, and reporting layers continue working unchanged.
