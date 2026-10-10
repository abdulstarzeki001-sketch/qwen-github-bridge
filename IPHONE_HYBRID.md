# iPhone local Qwen + Cloudflare fallback

This project supports two independently selected modes on `/ai.html`.

**Local mode:** A GGUF file alone is not an API. Install an iOS GGUF runtime that supports Qwen2.5 Coder 7B, exposes an OpenAI-compatible HTTPS chat-completions endpoint on the iPhone, and explicitly permits CORS requests from the STAR Pages origin. Enter its localhost URL in the local field. iOS background suspension, local HTTPS trust, Safari mixed-content rules, and CORS may prevent this from working; no local runtime is installed by this PR. Do not expose local inference to the internet. The local URL is not saved.

**Cloud mode:** Cloudflare Pages Functions use `env.AI` when the Pages variable `STAR_AI_PROVIDER=cloudflare` is set and the `AI` binding is deployed. The current cloud model is `@cf/meta/llama-3.1-8b-instruct`, *not* the user's local Qwen GGUF. Workers AI quotas apply and inference is not guaranteed unlimited or continuously available.

**Authentication remains required:** Cloud `/api/chat` continues to require `STAR_API_TOKEN` bearer auth; the no-key UI does not yet authenticate, so cloud chat returns 401 until a secure owner session (e.g. Cloudflare Access with server-side validation) is implemented. Never place the bearer secret in frontend JavaScript. No automatic failover is enabled until both backends can be authenticated and tested.

The website may remain online 24/7, but iOS cannot reliably host a model 24/7 in the background. The GGUF is not uploaded or synced by this PR.
