# STAR SOVEREIGN AI — Owner control roadmap

## What this increment actually adds

- An owner-only inference studio at `/sovereign.html` linked from `/ai-v2.html`.
- Per-request owner-defined instructions (up to 4,000 characters), temperature (0–1), response budget (128–4096 tokens) and an optional server-allowlisted model override.
- Optional same-device local storage for the owner's tuning profile; never store credentials there.
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

Review and run `node scripts/test-sovereign.mjs` before merging. Build/CI and security checks are required; this PR is intentionally **not auto-merged**.
