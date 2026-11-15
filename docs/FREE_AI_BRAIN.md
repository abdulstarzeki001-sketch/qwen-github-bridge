# Free AI Brain — Cloudflare Workers AI

The live STAR web app is hosted by Cloudflare Pages. Its production and preview environments have a Workers AI binding named `AI`, and the chat handler uses that binding by default.

## What you need

No separate Cloudflare account ID, API token, GPU, model download, OpenRouter key, or OpenAI key is needed for Pages chat. The model is:

```text
@cf/meta/llama-3.1-8b-instruct-fp8
```

The binding is configured in [wrangler.toml](../wrangler.toml) and in the Cloudflare Pages project. The application calls `env.AI.run(...)`; it does not call the Cloudflare REST API.

Workers AI has a free daily allocation. Quota and billing depend on the Cloudflare plan; on the Free plan, requests pause after the daily quota is reached until it resets. See [Cloudflare's current Workers AI pricing](https://developers.cloudflare.com/workers-ai/platform/pricing/).

## Provider changes

Leave `STAR_AI_PROVIDER` unset to use the bound Workers AI model. If you intentionally switch providers, configure that provider's credentials as Cloudflare Pages secrets and set the matching provider variable. Never commit credentials to Git.

The Docker/FastAPI runtime has separate configuration. For a private GPU host running Qwen and Open Interpreter, see [the independent AI runbook](../deploy/independent-ai/README.md). Open Interpreter runs on that GPU host; it is not a shell executor inside Cloudflare Pages.
