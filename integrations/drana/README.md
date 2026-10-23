# 04 — Drana-Infinity model on local Ollama

Upstream code: https://github.com/IHA089/Drana-Infinity

This integrates only the Drana **model via Ollama**, not its privileged browser automation or command-execution UI. The STAR self-hosted gateway already accepts OpenAI-compatible inference.

From your own Mac/Linux model host:

```sh
bash integrations/drana/run-ollama.sh
```

Default: `IHA089/drana-infinity-3b:3b`. Allowed: `1.5b`, `3b`, `7b` tag variants. The command downloads model weights on the machine where you invoke it, then starts interactive inference. No model is downloaded on GitHub Actions or Cloudflare Pages.

After configuring the STAR authenticated inference gateway against your persistent Ollama server, set Cloudflare Pages provider and model variables:

```ini
STAR_AI_PROVIDER=selfhosted
STAR_SELFHOSTED_URL=https://YOUR_PRIVATE_GATEWAY/v1/chat/completions
STAR_SELFHOSTED_MODEL=IHA089/drana-infinity-3b:3b
STAR_ALLOWED_MODELS=IHA089/drana-infinity-3b:3b
```

Store `STAR_SELFHOSTED_TOKEN` as a Cloudflare **secret** matching your gateway bearer token. The example URL is not functional. Do not expose the raw unauthenticated Ollama port to the internet.

Cloudflare Pages does not have a local GPU and cannot run Ollama itself. A persistent host is necessary to answer web/iPhone/Telegram requests.
