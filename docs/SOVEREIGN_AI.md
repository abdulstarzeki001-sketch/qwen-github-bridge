# STAR SOVEREIGN AI — Owner control roadmap

## What this increment actually adds

- An owner-only inference studio at `/sovereign.html` linked from `/ai-v2.html`.
- Per-request owner-defined instructions (up to 4,000 characters), temperature (0–1), response budget (128–4096 tokens) and an optional server-allowlisted model override.
- Optional same-device local storage for the owner's tuning profile; never store credentials there.
- Optional authenticated server-side profile storage via Cloudflare Pages KV binding `STAR_OWNER_SETTINGS`, supporting read, save, and delete from multiple owner devices.
- The backend uses saved settings as defaults when requests do not override them.
- An opt-in, session-only prompt context assembled on the client. Conversation history is not saved by this page.
- Owner authentication is **still required** for `POST /api/chat`. No new GitHub writes, deployment permissions, shell access or web tools are added.
- Backend rejects model identifiers not listed in `STAR_ALLOWED_MODELS`. A requested model must be supported by the configured provider. No provider switching is performed by a prompt.
- Cloudflare Workers AI's fixed model binding is not changed by a model override.

## Deployment configuration

Configure sensitive values only in **Cloudflare Pages environment settings**, never in HTML or GitHub repository source:

```text
STAR_API_TOKEN=<server-only random secret of at least 32 characters>
STAR_AI_PROVIDER=selfhosted | openrouter | openai | anthropic | cloudflare
STAR_ALLOWED_MODELS=provider-model-one,provider-model-two
STAR_OWNER_POLICY_JSON={"identity":"STAR AI","instructions":"Your owner-defined base instructions."}
```

Keep the selected provider's credentials in the Pages Secrets configuration. `STAR_ALLOWED_MODELS` is optional: when unset, the override field is disabled by the backend and the provider's default model is used. An empty override always uses that default.

### Enable owner profile synchronization (optional)

The default behavior is browser-only and needs no Cloudflare KV. To synchronize owner tuning settings across devices:

1. In the Cloudflare account that actually owns the `star-cyber-ai-x` Pages project, create a Workers KV namespace dedicated to STAR (for example, `STAR_SOVEREIGN_SETTINGS`).
2. Open **Workers & Pages → star-cyber-ai-x → Settings → Bindings → Add → KV namespace**.
3. Set the **binding variable name exactly** to `STAR_OWNER_SETTINGS` and select the new namespace.
4. Redeploy the Pages project for the binding to take effect. Set it for both preview and production only if you need both environments. Prefer separate KV namespaces to isolate preview from production.
5. Activate your owner session on `/ai-v2.html`, then visit `/sovereign.html`; use **Save to STAR server** and reopen from another authenticated device.

The routes `GET /api/owner/settings`, `PUT /api/owner/settings`, `DELETE /api/owner/settings` require owner authentication. For writes with cookie authentication, the server additionally requires a same-origin `Origin` header. When no KV is configured, GET reports `enabled:false`, and PUT/DELETE refuse the write.

**Do not use KV for credentials, secrets, or unencrypted personal memories.** This profile stores only instruction text, model identifier, temperature and response budget. Workers KV is eventually consistent (changes can take about a minute to appear in another location) and throttles multiple writes to one key per second. If strong consistency is essential, use a database or Durable Object instead.

### Self-hosted inference

When `STAR_AI_PROVIDER=selfhosted`, the current Cloudflare Pages function requires:

```text
STAR_SELFHOSTED_URL=https://your-authenticated-inference-gateway.example/v1/chat/completions
STAR_SELFHOSTED_TOKEN=<private gateway access token>
STAR_SELFHOSTED_MODEL=<model identifier served by your gateway>
```

The gateway must validate the Bearer token, use TLS, and forward only authenticated traffic to your local runtime. Do **not** expose an unauthenticated Ollama or vLLM listener on the public internet.

**Important:** `/api/health` reports configuration readiness, not an actual generated answer. Confirm inference from the owner studio.

## Open-weight model stack

For maximum operator control, host inference on a machine that you manage. Ollama is easier for first deployment; vLLM is better suited to dedicated GPUs and multi-user throughput. Both offer OpenAI-compatible chat APIs. Choose the model **after checking physical RAM/VRAM, expected quantization, context length, and license**. Qwen3-Coder models are a suitable coding-focused family, but large models still require substantial hardware.

The iPhone is a frontend, not the required GPU host. Keep authentication, inference gateway and private keys server-side.

## Next milestones (not implemented by this PR)

1. **Isolated tool gateway**: read-only GitHub code search first; then explicit reviewable write plans, diffs, tests and human approval before commit, merge or deployment.
2. **Long-term memory**: encrypted per-owner storage, explicit remember/forget, export, retention and audit events. Never use unencrypted localStorage for secret memories.
3. **Tool permissions UI**: individual scopes for shell, browser, repository, cloud deployment and third-party APIs; default deny, short-lived credentials and sandboxed execution.
4. **Evaluation harness**: reproducible Arabic/coding/security tasks, hallucination tests, tool-use success, privacy checks, token cost and latency tracking.
5. **Training/adaptation**: retrieval-augmented memory and explicit instruction tuning first; LoRA/fine-tuning when data quality and GPU budget justify it.

## Security and operational boundaries

Having full ownership means controlling the runtime, data and application permissions. It does not imply guaranteed correctness, unbounded compute, immunity to licensing obligations or automatic bypass of a hosted provider's rules.

This page saves only settings when the owner explicitly clicks Save. If saved, settings remain unencrypted in that browser's local storage. The prompt and custom instructions are transmitted to the configured inference provider on submission, even when the chat UI itself does not upload the local profile.

Review and run `node scripts/test-sovereign.mjs` and `node scripts/test-sovereign-settings.mjs` before merging. Build/CI and security checks are required; this PR is intentionally **not auto-merged**.
