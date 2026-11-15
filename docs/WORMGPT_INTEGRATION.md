# STAR CYBER AI X — optional WormGPT-compatible provider

**Status: code integrated; inference NOT enabled by default.**

There is no independently verified distribution of the original 2023 WormGPT weights or API. This integration does not claim to install the original model and never downloads community WormGPT executables, NPM packages or adapters. The word "wormgpt" here is a selectable **provider label** for a separately sourced and reviewed OpenAI-compatible Chat Completions server.

## Architecture

Owner-authenticated STAR app -> Cloudflare Pages `/api/chat` -> HTTPS bearer-authenticated OpenAI-compatible `/v1/chat/completions` endpoint. The token stays server-side in Cloudflare Pages secrets. Request prompt and owner instructions are redacted by STAR before transfer. The backend does not gain access to GitHub tokens or execution tools by switching the inference model.

## Production setup (Cloudflare Pages)

**Do not enable the provider until a trustworthy endpoint has passed security review.** In the STAR Cloudflare Pages project, configure:

```ini
STAR_AI_PROVIDER=wormgpt
STAR_WORMGPT_URL=https://your-reviewed-inference-host.example.org/v1/chat/completions
STAR_WORMGPT_MODEL=exact-model-id-from-your-server
STAR_ALLOWED_MODELS=exact-model-id-from-your-server
```

Add **encrypted secret** `STAR_WORMGPT_TOKEN`: a randomly generated bearer token of 32+ characters validated by your private inference gateway. Never commit the token or paste it into the browser. Do not use a fake or guessed URL. The example above is intentionally nonfunctional.

If the backend has no verified HTTPS OpenAI-compatible API, this integration cannot activate it. A service that only offers a web page, browser session, APK or CLI is **not** an API endpoint.

Requirements for the endpoint:
- HTTPS on port 443, no URL userinfo, query strings or fragments.
- Path exactly `/v1/chat/completions` (or `/chat/completions`).
- Public DNS hostname leading to a **protected** inference gateway; never expose unauthenticated Ollama.
- Externally enforced token auth, rate limits, audit controls and a model ID that actually exists.
- Responses formatted as OpenAI Chat Completions JSON, with `choices[0].message.content`.
- Independent review of model license, origin, prompt retention and operator privacy before sending private information.

**Switching back**: change `STAR_AI_PROVIDER` to its previous value (`cloudflare`, `selfhosted`, etc.) and redeploy. Do not delete the existing configuration until this is tested.

## Verification

```sh
node scripts/test-wormgpt.mjs
npm run check:cloudflare
```

Health `GET /api/health` displays `ai_provider: wormgpt` and `ai_gateway: true` when the URL, model and token are configured. **This does not test live reachability**; a real owner-authenticated chat request is required to verify actual inference.

The existing STAR SOVEREIGN owner console shows the configured provider status. Its model input may only override server-allowlisted models; it does **not** switch providers and never accepts provider tokens.

## Local FastAPI/Docker

An equivalent optional adapter is available in `app/config.py`:

```ini
AI_PROVIDER=wormgpt
WORMGPT_BASE_URL=https://your-reviewed-inference-host.example.org/v1
WORMGPT_API_KEY=YOUR_PRIVATE_SERVER_SECRET
WORMGPT_MODEL=exact-model-id-from-your-server
```

The FastAPI provider uses existing evidence redaction and analyst/verifier methods. Keep environment variables outside source control. An `https://` host and a real API are required to make requests.

## Warnings

- **Never install** the known-malicious `wormgpt-cli` NPM package.
- Do not trust a model based on its WormGPT branding alone.
- No execution privileges or GitHub write permissions are added by this feature.
- This is infrastructure support, not proof that WormGPT is installed, reliable or running.
