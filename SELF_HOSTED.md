# STAR AI ∞ — self-hosted open-weight model

STAR supports an OpenAI-compatible **HTTPS** inference endpoint. This lets the owner use an appropriately licensed open-weight model on infrastructure they control.

## Cloudflare Pages secrets and variables
- `STAR_AI_PROVIDER=selfhosted`
- `STAR_SELFHOSTED_URL=https://YOUR-PRIVATE-INFERENCE-HOST/v1/chat/completions` (HTTPS required)
- `STAR_SELFHOSTED_TOKEN` = a private bearer token accepted by your inference gateway (Cloudflare secret)
- `STAR_SELFHOSTED_MODEL=llama3.2:3b` or the exact model name served by your inference server

Do not expose the inference server publicly without authentication, request quotas, and TLS. Do not commit tokens to GitHub. Keep `STAR_API_TOKEN` configured for the existing chat route. Owner policy can be configured with `STAR_OWNER_POLICY_JSON` as described in `OWNER_POLICY.md`.

## Example local inference setup

Install Ollama on your own compatible host, then run:

```sh
ollama pull llama3.2:3b
ollama serve
```

Ollama normally serves on localhost:11434. Use a protected HTTPS reverse proxy that verifies the `STAR_SELFHOSTED_TOKEN` bearer token before forwarding to Ollama's OpenAI-compatible `/v1/chat/completions` endpoint. Cloudflare Pages cannot reach localhost on your device.

**Important:** Cloudflare Pages hosts the frontend and request gateway, **not** the model weights. Running the model requires your own computer/server or hosted GPU; availability and cost depend on that infrastructure. Open weights are not the same as an unlimited free hosted service.

The model's license, safety behavior, and practical abilities remain applicable. Owner-defined instructions are not a guarantee of unconditional compliance.
