# STAR AI — cloud-only configuration

STAR AI provides one primary mode through `/ai-v2.html`: an authenticated, server-backed cloud assistant. The old on-device inference and automatic model-fallback modes are retired.

## Operating the AI

1. Open `https://star-cyber-ai-x.pages.dev/ai-v2.html`.
2. Use the existing trusted-owner session. Only the verified owner can send inference requests.
3. Send a request; the browser calls `POST /api/chat` on the same origin.
4. The Cloudflare server selects the provider and model from its server-only configuration. The current default OpenRouter provider uses `nvidia/nemotron-3-ultra-550b-a55b:free`.
5. STAR Vault continues to save conversations, research and preferences locally, with optional Supabase sync only when configured.

## Privacy and safety

- No local HTTP model server, tunnel, browser-side model selector, or device-level inference dependency is required.
- Provider API keys stay in Cloudflare encrypted secrets, never browser code.
- Historical PRIVATE conversations remain stored locally where available and are excluded from automatically attached cloud context; removing an inference integration does **not** silently delete personal conversation records.
- Browser-local keys used by the retired integrations are removed on loading the updated STAR page; any installed iPhone application must be uninstalled directly on the device.
- Cloud availability depends on the configured provider and owner authentication. The application cannot guarantee external provider uptime.

## Rollout

The same GitHub deployment process publishes the `main` branch to Cloudflare Pages. Old `/ai.html` links redirect to the primary cloud page.
