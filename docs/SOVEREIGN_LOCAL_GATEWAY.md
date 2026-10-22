# STAR SOVEREIGN — private Ollama gateway

This is a minimal, authenticated bridge between the STAR Cloudflare Pages API and a **self-hosted** language model running on your own machine. Your private model is not executed on Cloudflare. Cloudflare forwards an authenticated request to the tunnel; `sovereign-gateway/server.mjs` validates it and forwards to local Ollama.

The gateway adds **no repository modification, shell execution or arbitrary URL fetching**. It accepts only `POST /v1/chat/completions` and `GET /health` with the correct bearer token. All upstream model requests go to a fixed localhost Ollama address.

## Prerequisites

- A machine under your control capable of hosting a model, with RAM/VRAM appropriate to its size.
- Node.js 24 or newer (the repository already uses Node 24 in CI).
- Ollama installed with a model downloaded locally.
- A Cloudflare account/domain, with a named Cloudflare Tunnel for a stable HTTPS hostname.

Your iPhone connects to **STAR Pages**, not directly to Ollama. This gateway must run on your computer/server, not on Cloudflare Pages.

## 1. Start inference on the model host

Install Ollama following the official instructions: https://ollama.com/download

Download a small starter model:

```bash
ollama pull qwen3:8b
ollama list
```

Ollama usually listens on `127.0.0.1:11434`. Do not open port 11434 to the internet. Ensure the selected model is actually loaded and responds before connecting STAR.

## 2. Start the authenticated gateway (on the same host)

From this repository:

```bash
export SOVEREIGN_GATEWAY_TOKEN="<your long random token, at least 32 characters>"
export SOVEREIGN_ALLOWED_MODELS="qwen3:8b"
export SOVEREIGN_GATEWAY_PORT="7088"
node sovereign-gateway/server.mjs
```

Generate the secret securely instead of typing a guess; one example on a machine with Node:

```bash
node -e 'console.log(require("node:crypto").randomBytes(48).toString("hex"))'
```

Put credentials in your machine's environment or a secret manager. Never commit them to GitHub and never store them in the browser.

Local verification:

```bash
curl http://127.0.0.1:7088/health \
  -H "Authorization: Bearer $SOVEREIGN_GATEWAY_TOKEN"
```

This endpoint returns only the gateway's status and allowlisted models. Verify that a POST to `/v1/chat/completions` returns model output separately. A healthy gateway alone **does not prove the local AI works**.

## 3. Create a stable HTTPS tunnel

Use Cloudflare's documented named Tunnel flow: https://developers.cloudflare.com/tunnel/get-started/

- Create a tunnel in the Cloudflare account that manages your domain.
- Publish a dedicated hostname such as `brain.your-domain.example`.
- Set the service URL to `http://127.0.0.1:7088` on the model host.
- Keep the gateway and Ollama bound to loopback; do not add router port forwarding.
- Restrict requests further with Cloudflare firewall/WAF where available. The gateway itself always demands the bearer token.

A tunnel makes the gateway *reachable* but does not by itself protect the endpoint; the gateway token is the mandatory authentication boundary.

## 4. Connect Cloudflare Pages to your private inference

In the **Cloudflare Pages project runtime secrets/environment** (not in GitHub source or frontend):

```text
STAR_AI_PROVIDER=selfhosted
STAR_SELFHOSTED_URL=https://brain.your-domain.example/v1/chat/completions
STAR_SELFHOSTED_TOKEN=<exact same SOVEREIGN_GATEWAY_TOKEN>
STAR_SELFHOSTED_MODEL=qwen3:8b
STAR_ALLOWED_MODELS=qwen3:8b
```

In Cloudflare Pages, deploy the site with these env vars. The current server validates that the self-hosted endpoint uses HTTPS and ends in `/chat/completions`. The gateway enforces the per-request allowlist regardless of what the browser asks.

## 5. Validate end-to-end

1. Sign in as the STAR owner via `/ai-v2.html`.
2. Visit `/sovereign.html`, keep the model field empty to use `STAR_SELFHOSTED_MODEL` or enter `qwen3:8b`.
3. Send a harmless test question.
4. Check response correctness and latency; `/api/health` reports only whether configuration is present.
5. Verify that turning off your gateway causes a clean error, not a fallback that secretly sends private prompts to a cloud model.

## Resource limits and security

- The starter gateway uses Node.js built-in modules only.
- All requests require a 32+ character bearer token; comparison is based on constant-time digest comparison.
- Model IDs are allowlisted, message sizes limited, and only text chat is accepted.
- The gateway caps concurrent inference jobs (default 2); adjust `SOVEREIGN_MAX_CONCURRENT` between 1 and 16 according to available hardware.
- The gateway pins its upstream to loopback `/v1/chat/completions`; you can override `SOVEREIGN_OLLAMA_URL` only with another loopback address.
- It does not promise unlimited compute, reliability, memory, tool execution, or policy-free hosted providers.
- Running this service on your hardware means you can choose open-weight models whose licenses permit your intended use, change their prompts, extend them with tools and evaluate or fine-tune them separately.

For automated tests that need no GPU or Ollama installation, run:

```bash
node scripts/test-sovereign-gateway.mjs
```

The test uses a mocked Ollama upstream. Passing it does not establish that a model is installed or running.
