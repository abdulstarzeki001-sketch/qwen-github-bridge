# Claude via Cloudflare

STAR exposes an Anthropic-compatible owner gateway through Cloudflare Pages Functions.

## Endpoint

Use this as the Claude **Base URL** in InferrLM:

```text
https://star-cyber-ai-x.pages.dev/api/claude/v1
```

InferrLM can then call:

- `POST /api/claude/v1/messages`
- `POST /api/claude/v1/messages/count_tokens`
- `GET /api/claude/v1/models`
- `GET /api/claude/v1/models/:id`

Cloudflare forwards allowed requests to Anthropic. The real Anthropic API key never needs to be stored in InferrLM.

## Cloudflare environment

Configure these in the Cloudflare Pages project environment:

### Secrets

```text
ANTHROPIC_API_KEY=<your Anthropic API key>
STAR_CLAUDE_PROXY_TOKEN=<random 32+ character owner proxy token>
```

### Variables

```text
STAR_ANTHROPIC_MODEL=claude-sonnet-4-6
STAR_AI_PROVIDER=anthropic
```

`STAR_AI_PROVIDER=anthropic` makes STAR's POWER mode use Claude as well. It is optional if you only want the InferrLM proxy.

## InferrLM

Set:

```text
Display Name: STAR Claude
API Key:      <STAR_CLAUDE_PROXY_TOKEN>
Model Name:   claude-sonnet-4-6
Base URL:     https://star-cyber-ai-x.pages.dev/api/claude/v1
```

The API Key field contains the STAR proxy token, **not** the Anthropic API key.

## Security properties

- Anthropic credential remains server-side in Cloudflare.
- Gateway accepts only a small allowlist of Anthropic API routes.
- Gateway requires a separate 32+ character owner proxy token.
- Claude model is forced server-side with `STAR_ANTHROPIC_MODEL`; a client cannot silently switch to another model.
- Message `max_tokens` is capped at 8192 at the proxy.
- Provider responses are not cached.

If Cloudflare Access is configured to intercept the entire site before Pages Functions, create an Access rule that lets the dedicated `/api/claude/*` path reach the function and rely on the gateway token for that path. Do not make the gateway unauthenticated.
