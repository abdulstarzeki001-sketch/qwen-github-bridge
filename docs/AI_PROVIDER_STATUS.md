# AI Provider Status

## Active runtime path

STAR CYBER AI X needs an external inference provider for its always-on web and Burp runtime.

Recommended free-start provider:

- Cloudflare Workers AI
- `AI_PROVIDER=cloudflare`
- runtime credentials stored only as deployment or GitHub Actions secrets

## GitHub Models

GitHub fully retired GitHub Models on July 30, 2026. STAR does not use that retired inference API.

## GitHub responsibilities

GitHub remains the control plane for:

- source control
- pull requests and change history
- CI
- Docker image publishing to GHCR
- Burp extension build artifacts
- repository intelligence source
- Dependabot and project automation

## Remaining activation requirement

The live AI runtime needs:

```text
CLOUDFLARE_ACCOUNT_ID
CLOUDFLARE_API_TOKEN
```

These values must come from the Cloudflare account. They must not be committed to source code.
