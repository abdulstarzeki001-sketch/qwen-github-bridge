# 03 — WormGPT Telegram bot

Public reference: https://github.com/jailideaid/WormGPT

GitHub CI clones a pinned archive of the public Python bot and verifies it compiles, imports and builds an offline Telegram client. This tests software startup without registering or sending messages as an actual Telegram bot.

**STAR already has a more suitable Cloudflare Telegram webhook**: `functions/_nexus_telegram.js`, protected by the Telegram secret header and allowed private-chat IDs, routed to the configured STAR model. Do not run two bots with the same Telegram token unless you intentionally coordinate webhook/polling.

For a real bot, configure the following in Cloudflare Pages secrets and register the webhook using Telegram Bot API:

- `TELEGRAM_BOT_TOKEN`: the token BotFather provides
- `TELEGRAM_WEBHOOK_SECRET`: 32+ random characters
- `TELEGRAM_ALLOWED_CHAT_IDS`: your numeric Telegram user/chat ID

Open the in-site guide at https://star-cyber-ai-x.pages.dev/telegram-setup.html

Until these values are configured, CI verification is not a live Telegram bot and the site must not claim otherwise.
