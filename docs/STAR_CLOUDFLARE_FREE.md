# STAR AI — use Cloudflare Workers AI without renting a GPU

The deployed STAR Pages project already defines the Workers AI binding `AI` in `wrangler.toml`. Inspection on October 22, 2026 also confirmed that the Cloudflare production project has that binding and **does not have a `STAR_AI_PROVIDER` override**.

When an AI binding exists and no explicit provider has been set, `/api/chat` now chooses:

- Provider: Cloudflare Workers AI
- Model: `@cf/meta/llama-3.1-8b-instruct`
- Max output tokens per inference: 512
- Requires STAR owner authentication; model cannot be changed by public request
- `GET /api/health` reports `ai_gateway` and `ai_model` without sending an inference request or accessing paid keys
- STAR Supabase sync and saved Runpod Pod template are untouched

## Billing and quotas

Workers AI has a **10,000 Neurons per day free allocation**. On the Workers Free plan, requests past the allowance fail; no automatic free upgrade exists. On the Workers Paid plan, usage beyond the free allowance can incur charges. The Workers plan was not exposed by the read-only project inspection, so **zero charges cannot be guaranteed** without checking the actual account billing plan and usage. Do not assume a model binding implies an unlimited free service.

The owner can review Workers AI usage in Cloudflare. The backend uses a small fixed free-tier model and caps generation at 512 output tokens, but **this limit is not a hard financial spending cap**. The existing server owner authentication prevents anonymous callers from consuming the allowance. Avoid publishing owner keys.

## Switching back to an independent model

At any time, Cloudflare Pages production variables can explicitly select a provider:

```ini
STAR_AI_PROVIDER=selfhosted
STAR_SELFHOSTED_URL=https://YOUR_RUNPOD_POD_ID-8080.proxy.runpod.net/chat/completions
STAR_SELFHOSTED_MODEL=gpt-oss:20b
STAR_SELFHOSTED_TOKEN=<set as encrypted secret in Cloudflare and match Runpod backend token>
```

Do not change these settings until a paid Runpod GPU Pod is running and verified. With `STAR_AI_PROVIDER` unset, Cloudflare Workers AI is the default when binding `AI` exists. If the binding is absent, the old OpenRouter path is still available when its key is configured.

Cloudflare documentation:
- https://developers.cloudflare.com/workers-ai/platform/pricing/
- https://developers.cloudflare.com/pages/functions/bindings/
