# STAR HYBRID — iPhone Qwen local first, Cloudflare cloud fallback

## What runs where

- **The web UI** is published on Cloudflare Pages: https://star-cyber-ai-x.pages.dev/ai-v2.html
- **Qwen local** runs only inside InferrLM on your iPhone and serves a loopback API, normally `http://127.0.0.1:8889`.
- **Qwen cloud** runs remotely through the already configured STAR Cloudflare Pages `/api/chat` endpoint and its OpenRouter key, not inside the iPhone.
- Cloudflare cannot keep InferrLM alive in the background on iOS. Apple suspends normal apps after they leave the foreground. This Hybrid flow maintains availability of the web UI *when the existing cloud provider is operational*; it cannot provide local Qwen inference with the phone locked.

## Getting started on the same iPhone

1. Install InferrLM, download a suitably sized local **Qwen** model, and confirm the model responds in the app.
2. In InferrLM's Server tab enable its HTTP server. Confirm that `http://127.0.0.1:8889/api/tags` returns model names in Safari **while the server is running**.
3. On the same iPhone, visit https://star-cyber-ai-x.pages.dev/ai-v2.html and choose **HYBRID · Qwen + Cloud**.
4. Use **فحص InferrLM** to check model discovery. If the connection works, STAR prefers an installed Qwen model.
5. Activate **أوافق على التحويل التلقائي للسحابة عندما يتوقف Qwen المحلي** for this browser if you want the site to move to cloud after a local connection failure without asking on every request. This consent is saved locally; remove it at any time. If this option is unchecked, STAR asks for approval **per failed request**. It never silently sends a fallback request to cloud.
6. Sign in as the single STAR owner (on a previously trusted device this happens automatically). Test Qwen local while InferrLM is active. Then disable InferrLM's server and send a harmless message in HYBRID to test the approved fallback.

## Privacy and behavior

- **PRIVATE**: no Cloudflare model inference ever, even if Qwen is offline.
- **HYBRID**: tries local Qwen; on failure only sends **the currently submitted prompt** to the STAR cloud if explicitly approved. It does **not** upload saved PRIVATE chat context, even when memory is enabled.
- **POWER**: directly uses the configured cloud provider with the normal non-private memory context.
- Owner identity and cloud provider API keys remain checked server-side. The fallback consent itself is a browser preference, not a token.
- HYBRID messages remain device-only under STAR Vault's local-first privacy rules, even when the answer comes from the cloud.
- The user interface reports the actual responding model and indicates when an additional backup cloud provider/model was used.

## Provider selection

For an authenticated `POST /api/chat` with `{"hybrid_cloud":true}`, when `STAR_AI_PROVIDER` is OpenRouter (or unset, its default), STAR tries:

```text
qwen/qwen3-8b:free
```

Use optional server-only variable `STAR_HYBRID_QWEN_MODEL` to choose another supported OpenRouter Qwen model. On 404/429/5xx, the server tries the existing `STAR_CLOUDFLARE_MODEL` backup (currently a Nemotron configuration) to avoid interruption. OpenRouter free models may be rate-limited or withdrawn and are **not guaranteed** available 24/7. The actual served model is returned to the UI.

The existing Cloudflare `OPENROUTER_API_KEY` must be configured. The production `/api/health` endpoint only confirms whether a provider is configured, not whether either specific model is producing correct output.

## iOS/browser restrictions

- The hosted HTTPS page fetches `http://127.0.0.1:8889` from Safari. Depending on iOS WebKit version, loopback security restrictions and whether InferrLM supports cross-origin requests, the browser may reject the request. Cloudflare cannot fix InferrLM's local CORS policy. A direct `/api/tags` Safari visit only tests that the server is reachable, **not** that cross-origin fetch from STAR succeeds.
- iOS may suspend/terminate InferrLM when switching applications or locking the screen. Leave InferrLM alive while experimenting. If the local server cannot stay reachable, expect HYBRID to use the approved cloud fallback.
- A Cloudflare Tunnel **does not** make an iPhone process persist in the background. The remote URL continues to work with the cloud brain when local Qwen is not running.

## Validation

```sh
node scripts/test-star-hybrid.mjs
node --check web/star-hybrid.js
```

Then in Safari test both permission paths. Do **not** include private secrets in test messages.

This change does not remotely install a local model or launch InferrLM on the phone. Those tasks require the owner to open and configure the app on the actual iPhone.
