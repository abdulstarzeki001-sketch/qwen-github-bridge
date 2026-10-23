# NEXUS V3 — sources and integration boundaries

**Goal:** One mobile-first app, one authenticated AI backend, optional private-model inference, Telegram webhook, GitHub read-only repository intelligence, and a catalog of public WormGPT-related projects.

## Included as working first-party STAR features

- **STAR NEXUS UI**: \`web/index.html\`, \`web/nexus.css\`, \`web/nexus.js\`; PWA home \`/\` supports Safari on iPhone and iPad.
- **AI chat**: existing owner-only \`/api/chat\`. Provider is selected server-side (Cloudflare, selfhosted, WormGPT-compatible HTTPS, OpenAI, Anthropic, OpenRouter). No untrusted model files or provider tokens are in the frontend.
- **Telegram Bot**: \`functions/_nexus_telegram.js\` and \`/api/telegram/webhook\`, private allowlisted chat IDs, Telegram secret header, bounded input, shared configured AI inference, no GitHub write or shell tools. Requires Cloudflare bot secrets and registering Telegram webhook. Read \`web/telegram-setup.html\`.
- **GitHub**: existing owner-authenticated GitHub repository intelligence, scanners and findings are preserved.
- **Models**: shared backend for local Ollama/Qwen/Drana via self-hosted inference URL when an actual model server is running.

## Public source references (not bundled in production)

The source list is displayed under the Agent Integrations tab. We **do not claim these are official WormGPT weights** or audited distributions. Code was not blindly vendored; certain projects contain compiled, obscured or automatically executable code, and licensing differs. Links are for provenance and manual retrieval. Core UX and integrations were independently implemented.

| Source | Role | Runtime inclusion |
| --- | --- | --- |
| https://github.com/WormGPTv2/wormgpt | local coding agent / Ollama-capable CLI | optional standalone CLI, not copied |
| https://github.com/gaur-avvv/wormxgpt | React terminal and multi-model UI inspiration | functionality reimplemented with STAR auth |
| https://github.com/gaur-avvv/XGPT-WormGPT | text prompts and skills | catalog reference only |
| https://github.com/jailbreakwormGPT/wormGPT | purported WormGPT installer | reference only |
| https://github.com/0x6b6679/worm-ai | unofficial Grok client, binary-opaque dependency | reference only |
| https://github.com/0x6b6679/worm-gpt | archived project | reference only |
| https://github.com/cameleonnbss/WormGPT-desktop | Windows local model UI | reference only |
| https://github.com/lahirusanjika/Worm-GPT | Electron Groq-based chat UI | reference only |
| https://github.com/jailideaid/WormGPT | Telegram Python bot | STAR first-party Telegram integration is separate |
| https://github.com/shahzadkhld/wormgpt | Telegram fork | reference only |
| https://github.com/IHA089/Drana-Infinity | Ollama cyber security models, Python tooling | optional selfhosted model, app not vendored |
| https://github.com/prithwishpal/worm-gpt | Streamlit chat and Telegram-related project | reference only |
| https://github.com/father-bot/chatgpt_telegram_bot | Telegram interface pattern | first-party webhook implemented |
| https://github.com/wangrongding/wechat-bot | multi-channel bot architecture | reference for future adapters |
| https://github.com/JuraSecurity/Worm-GPT | unknown Windows EXE distribution | source reference only |
| https://github.com/MrZXN777/WormGPT- | ZIP archives with unverified binaries | source reference only |
| https://github.com/WormGPT-AI/WormGPT | README-only informational repository | reference only |

## Why the old files still exist

The old \`/ai-v2.html\`, vault, memory, Burp tooling, scanner, deployment pipelines, and owner session layer have live dependencies and tests. Removing them indiscriminately would break working features. The old homepage was moved to \`/legacy-dashboard.html\`, and its route was replaced with NEXUS V3. Redundant old code can be removed only after its import paths and dependent workflows have been migrated.

## Telegram setup

In Cloudflare Pages production environment set the following three values (secrets should be marked sensitive):

- \`TELEGRAM_BOT_TOKEN\`: bot token from @BotFather
- \`TELEGRAM_WEBHOOK_SECRET\`: random 32-256-character ASCII token \`[A-Za-z0-9_-]\`
- \`TELEGRAM_ALLOWED_CHAT_IDS\`: comma-separated list of numeric **private** chat IDs

Then register \`https://<YOUR_STAR_HOST>/api/telegram/webhook\` using Telegram \`setWebhook\` and the secret_token value. See \`web/telegram-setup.html\`.

Webhook's Telegram users cannot access the rest of \`/api/chat\` or privileged GitHub APIs by supplying a bot message, and Telegram tools are never imported into the main browser bundle.

## Validation

\`\`\`sh
node scripts/test-nexus-v3.mjs
npm run check:cloudflare
python -m pytest -q
\`\`\`

Existing functional tests still exercise STAR V2, vault, owner auth, and security workflows.
