# Cloudflare Pages deployment

## Existing production project

- Project: `star-cyber-ai-x`
- Repository: `abdulstarzeki001-sketch/qwen-github-bridge`
- Production branch: `main`
- Build output directory: `web`
- Build command: none
- Production URL: [star-cyber-ai-x.pages.dev](https://star-cyber-ai-x.pages.dev)

Pushing a commit to `main` triggers the Cloudflare Pages production deployment.

## AI chat

Production and preview environments already have a Workers AI binding named `AI`. With `STAR_AI_PROVIDER` unset, `functions/api/[[path]].js` selects that binding and runs `@cf/meta/llama-3.1-8b-instruct-fp8`.

Pages chat does not require `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN`, or an external model provider key. Workers AI usage is subject to Cloudflare's free allocation and plan limits; see [current pricing](https://developers.cloudflare.com/workers-ai/platform/pricing/).

## Owner sign-in

The project is protected by its Cloudflare Access application, with access limited to the owner's configured identity. `wrangler.toml` supplies the Access team issuer and app audience needed for the API to validate the Access JWT. The existing `STAR_API_TOKEN` remains the signing secret for remembered owner sessions; keep it in Cloudflare Pages secrets.

## Optional integrations

Add credentials as Cloudflare Pages secrets only when you enable the feature:

- `OPENROUTER_API_KEY`, `OPENAI_API_KEY`, or `ANTHROPIC_API_KEY`: optional alternate AI provider.
- GitHub App ID, installation ID, private key, and admin token: optional repository features.
- Telegram bot token, webhook secret, and allowed chat IDs: optional Telegram integration.
- `STAR_API_TOKEN`: owner API and remembered-session signing secret.

After changing Pages settings, redeploy the project. Never paste secrets into Git, issues, or screenshots.

## Open Interpreter

Cloudflare Pages does not run Open Interpreter or shell commands. The repository includes a separate GPU-host deployment under `deploy/independent-ai`; it requires an independently provisioned GPU server. Cloudflare Containers require a paid Workers plan, so they are outside the $0 Pages setup.

## Open Interpreter website mode

STAR includes an owner-only `/open-interpreter.html` page. Pages proxies tasks; the Interpreter process runs on the separate GPU host. Follow the [GPU host instructions](deploy/independent-ai/README.md#open-interpreter-from-the-star-website), then set `STAR_INTERPRETER_URL` and secret `STAR_INTERPRETER_TOKEN` in Cloudflare Pages production. Until a host is running and both values are configured, the page reports that the executor is disconnected. Workspace changes are not published automatically.
