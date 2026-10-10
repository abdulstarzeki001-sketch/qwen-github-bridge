# Netlify deployment

A Netlify project named **star-cyber-ai-x** has already been created.

## Repository configuration

The repository contains:

```text
netlify.toml
package.json
netlify/functions/health.mjs
netlify/functions/chat.mjs
web/index.html
```

Build configuration:

```text
Publish directory: web
Build command: npm run check:netlify
Functions directory: netlify/functions
```

## AI

The Netlify chat function uses Netlify AI Gateway with the OpenRouter SDK.

Default model route:

```text
openrouter/free
```

No OpenAI, Anthropic, Google, or OpenRouter API key is required from the user when Netlify AI Gateway is active.

The gateway activates after the first production deploy.

## Required one-time dashboard action

The Netlify connector can create and inspect projects, but it cannot attach an existing GitHub repository to the project.

In Netlify:

1. Open the `star-cyber-ai-x` project.
2. Choose to connect/import an existing repository.
3. Select GitHub.
4. Select `abdulstarzeki001-sketch/qwen-github-bridge`.
5. Use branch `main`.
6. Let `netlify.toml` provide build/publish/functions settings.
7. Run the first production deploy.

Do not add provider API keys.

## Access

The new Netlify project currently has team-login protection enabled. Keep that protection during setup so the AI endpoint is not exposed before you intentionally choose the public-access model.

## Optional model override

After the first deploy, you may set this non-secret project environment variable if you want to pin another live AI Gateway model:

```text
STAR_NETLIFY_MODEL=<model-id>
```

If omitted, STAR uses `openrouter/free`.

## Verification

After production deploy:

```text
GET /api/health
POST /api/chat
```

The health endpoint should report `runtime: netlify` and `ai_gateway: true`.
