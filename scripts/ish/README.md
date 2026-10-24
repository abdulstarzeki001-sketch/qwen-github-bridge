# STAR NEXUS — iSH on iPad (source checkout and preview)

**Purpose:** run a lightweight local preview and retrieve pinned public source trees from the integrated repositories using the iSH Alpine Linux environment. This does not run a GPU, Docker containers or Cloudflare Pages Functions inside iPadOS.

## Copy into iSH

```sh
apk update
apk add --no-cache git python3 curl ca-certificates openssh-client
cd ~
git clone --depth 1 https://github.com/abdulstarzeki001-sketch/qwen-github-bridge.git
cd qwen-github-bridge
sh scripts/ish/star.sh setup
sh scripts/ish/star.sh doctor
```

If the STAR folder already exists, do not delete it or clone over it. Instead use:

```sh
cd ~/qwen-github-bridge
sh scripts/ish/star.sh sync
```

The sync command requires a clean worktree on `main`, and does a fast-forward-only merge. It will not delete or overwrite local changes.

## Fetch complete source trees into the STAR project workspace

Seven upstream sources which have previously undergone **isolated build/import/source checks**:

```sh
sh scripts/ish/star.sh sources core
```

To list all 17 pinned references:

```sh
sh scripts/ish/star.sh sources list
```

To fetch all 17 public sources (more space / time; includes repositories with opaque archives or binaries, **do not execute anything from them**):

```sh
sh scripts/ish/star.sh sources all
```

To fetch a single source (example: Drana):

```sh
sh scripts/ish/star.sh sources one drana
```

The full source trees are now available under:

```text
integrations/upstreams/wormgpt-v2/
integrations/upstreams/wormxgpt/
integrations/upstreams/telegram-bot/
integrations/upstreams/drana/
integrations/upstreams/electron/
integrations/upstreams/streamlit/
integrations/upstreams/xgpt-prompts/
...
```

They are **local, ignored by Git**, and pinned to verified commit hashes in `scripts/ish/sources.psv`; STAR code is untouched. No `npm install`, `pip install`, `bash ./external.sh` or unknown executable is run. The earlier 7 CI validations were code/build tests, not security audits; do not give third-party programs production tokens or your main repo write access.

For a GitHub-generated *downloadable source bundle* (if cloning via iSH is too slow), see GitHub Actions → [Build STAR iSH Upstream Source Bundle](https://github.com/abdulstarzeki001-sketch/qwen-github-bridge/actions/workflows/ish-sources-bundle.yml). The workflow performs the same source fetch, strips nested .git metadata and provides a source artifact. CI does **not** execute the source programs.

## Open the STAR interface in iPad Safari

```sh
sh scripts/ish/star.sh serve 8080
```

On the **same iPad**, open `http://127.0.0.1:8080/` in Safari. Keep the iSH session alive. iPadOS can suspend iSH in the background; a lightweight local preview is not an always-on website.

**Important:** The local Python server only serves static HTML, CSS, JavaScript. Calls to `/api/chat`, `/api/github/browse`, authentication and model selection require the actual deployed Cloudflare Pages Functions. Use [STAR online](https://star-cyber-ai-x.pages.dev/) for interactive AI/chat/GitHub, or SSH to your own Linux/GPU server.

## Telegram: connect the first-party Cloudflare bot (no always-on iPad process)

1. Open `@BotFather` inside Telegram → `/newbot` and save the generated token privately.
2. Open your own bot conversation and send `/start`. Before setting a webhook, find your numeric private-chat ID from iSH:
   ```sh
   cd ~/qwen-github-bridge
   python3 scripts/ish/telegram.py bot-info
   python3 scripts/ish/telegram.py chat-id
   ```
   The script prompts for the token with hidden input. Do **not** enter it into a shell command, GitHub source file, or chat message.
3. In Cloudflare Pages project `star-cyber-ai-x` → **Settings → Variables and Secrets → Production**:
   - `TELEGRAM_BOT_TOKEN`: encrypted secret (the token from BotFather)
   - `TELEGRAM_WEBHOOK_SECRET`: encrypted secret with 32–256 URL-safe letters/digits/dashes
   - `TELEGRAM_ALLOWED_CHAT_IDS`: private numeric chat ID found in step 2
   - An actual AI provider must be configured, for example `STAR_AI_PROVIDER=cloudflare` **with** a working Workers AI `AI` binding.
4. Deploy Pages **after** configuring secrets. The webhook must be publicly accessible to Telegram, but is protected at the handler by the secret header and allowed chat IDs. If Cloudflare Access guards the entire site, configure only the webhook path to be reachable by Telegram; keep the rest owner-only.
5. Validate and register the bot from iSH:
   ```sh
   python3 scripts/ish/telegram.py check-star
   python3 scripts/ish/telegram.py set-webhook
   python3 scripts/ish/telegram.py status
   ```
   For `set-webhook`, type the **exact same** BotFather token and Telegram webhook secret stored on Cloudflare. The secret is never written to files.
6. In Telegram, send `/start` then ask a question. This uses STAR's **Cloudflare Webhook**, so iSH need not stay open to reply.

The two alternatives `getUpdates` (Telegram polling) and `setWebhook` are exclusive. If you need to run an upstream Python bot separately, give it a different bot token and a separate process/host; do not compete with STAR over the same bot.

**Limitations:** Telegram access is chat-only in the current STAR Cloudflare adapter. It cannot automatically run source repo commands, edit GitHub, deploy workers, or call shell tools via Telegram. Source downloads in `integrations/upstreams` are not services. The seven isolated upstream CI jobs are smoke tests, not persistent running integrations.

## Health & troubleshooting

```sh
sh scripts/ish/star.sh doctor
sh scripts/ish/star.sh sources status
git status
```

- `apk add` fails: iSH must be able to reach Alpine APK repositories. Check Internet and iSH Alpine mirror settings.
- Git TLS errors: install `ca-certificates`, then use HTTPS URLs (never disable TLS verification).
- Missing SSH key: do not copy keys into GitHub or public files. iSH SSH can connect to a separate GPU host.
- An upstream fetch fails: internet/GitHub availability or pinned-sha reachability may differ; the script continues with other repositories and records failed items. It does not switch to newer, unverified code silently.
- Storage pressure: default to `core`, then use `one ID`. `all` can be large.
- iSH cannot launch an independent GPU model. Running Ollama/RunPod and configuring cloud secrets requires the real GPU infrastructure described in `deploy/independent-ai/runpod/README.md`.

## What was integrated?

The STAR repository now tracks the iPad setup scripts, the 17-source provenance registry, offline tests, and a CI source-bundle job. Source checkouts are pulled into the local project workspace on demand rather than indiscriminately committed into production (which would make your website deploy unknown third-party source and increase size).
