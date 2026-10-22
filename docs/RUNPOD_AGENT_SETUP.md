# Runpod coding-agent onboarding for STAR Independent Brain

**Official setup entrypoint:** https://agents.runpod.io/
**Official instructions:** https://docs.runpod.io/agent-setup.md
**Runpod hosted MCP:** https://mcp.runpod.io/
**Skills repository:** https://github.com/runpod/runpod-plugins-official

This repository now builds and publishes STAR's independent inference container to GitHub Container Registry (GHCR), without requiring Runpod credentials or a paid GPU. It also has an authenticated GPU gateway and instructions at [Runpod Pod setup](../deploy/independent-ai/runpod/README.md). The linked account and paid Pod must be created in **your own Runpod session**. No AI coding assistant can authorize OAuth or consent to new GPU charges on your behalf.

For Codex on your own Mac, you may run the validated helper `bash scripts/setup-runpod-codex.sh` (it checks Node >=22.20, installs the official Skills + MCP plugin, and **does not** complete OAuth). The official manual commands are listed below.

## 1. Connect Runpod to your coding agent (official guide)

The following commands run **on your own Mac/Windows/Linux machine with an agent installed**, not inside ChatGPT on iPhone.

### Claude Code

```sh
claude plugin marketplace add runpod/runpod-plugins-official
claude plugin install runpod@runpod
claude plugin list
```

**User-only action:** in Claude Code run `/reload-plugins`, then `/mcp` → `runpod` → **Sign in with Runpod**. This is the official OAuth flow and does not require sharing your API key.

### Codex

Requires Node.js 22.20 or newer for the Skills installer. Check `node --version` first, then:

```sh
codex plugin marketplace add https://github.com/runpod/runpod-plugins-official.git
codex plugin add runpod@runpod
```

**User-only action:** restart Codex Desktop if required, then complete the Runpod OAuth sign-in when a Runpod MCP tool first runs. If the Runpod MCP tools are not visible after plugin installation:

```sh
codex mcp add runpod --url https://mcp.runpod.io/
```

Finish OAuth sign-in when prompted.

### Cursor / Copilot / Windsurf / Cline / other coding agents

The Skills installer requires Node.js 22.20 or newer. Confirm with `node --version` first.

Install skills non-interactively (example: Cursor). **Replace both** `--agent cursor` and `--client cursor` with the matching values for your own agent; don't install across every agent:

```sh
npx -y skills add runpod/runpod-plugins-official --skill '*' --agent cursor --yes --global
```

Then run the guided MCP installer on **your personal machine**:

```sh
npx @runpod/mcp-server@latest add --client cursor
```

Replace `--agent cursor` with `github-copilot`, `windsurf`, `cline`, `opencode`, etc., when using a different supported coding agent. Use `--client cursor` for Cursor, `--client vscode` for GitHub Copilot in VS Code, or `--client opencode` for opencode. This registers the hosted MCP server without prompting. You must finish OAuth login yourself.

**Verification:** once authenticated, ask the agent **“List my Runpod Pods.”** A successful empty list means the connection works. If OAuth has not been completed, the Runpod MCP is **not** connected regardless of skill-install success.

**ChatGPT limitation:** Runpod is not currently a connected Runpod app in this ChatGPT workspace; installing scripts in an isolated terminal or GitHub CI cannot register an OAuth connection in the ChatGPT app. Agent installation commands must be run on your personal Mac or a Codex/Claude terminal, not in this ChatGPT cloud session. Use a supported coding-agent client or an available Runpod integration when connected. Do not paste API keys or passwords in conversations.

## 2. Container image (automatic, no Pod/billing yet)

A GitHub Actions workflow at `.github/workflows/publish-star-runpod-image.yml` builds:
```text
ghcr.io/abdulstarzeki001-sketch/star-independent-ai:latest
```

The image bundles Ollama with the already-implemented token-protected Node HTTP gateway. The source repository is public; **the GHCR package may default to private** until you set its visibility to public via GitHub package settings. In Runpod, use a public image, or configure a compatible registry credential in Runpod without adding that credential to this repo.

View workflow: https://github.com/abdulstarzeki001-sketch/qwen-github-bridge/actions/workflows/publish-star-runpod-image.yml

## 3. Create the paid GPU Pod (requires Runpod account access)

Use the [Pod deployment guide](../deploy/independent-ai/runpod/README.md), which specifies a 24 GB NVIDIA GPU (e.g., RTX A5000), image `ghcr.io/abdulstarzeki001-sketch/star-independent-ai:latest`, exposed `8080/http`, no exposed `11434`, persistent `/workspace`, `STAR_MODEL=gpt-oss:20b`, and a random `STAR_BACKEND_TOKEN` stored *only* as a private Runpod environment variable.

This Pod is a **paid GPU resource**. Confirm current real-time availability and pricing inside your Runpod dashboard before creation. The use of the model at 24/7 capacity also incurs continuous GPU and storage charges.

Do **not** claim a running Pod until the Runpod API/MCP returns a real Pod ID and the model responds to an authenticated request.

## 4. Enable private inference in STAR only after tests pass

Keep STAR's current cloud provider until the Pod is verified. Then in the Cloudflare Pages production environment set:

```ini
STAR_AI_PROVIDER=selfhosted
STAR_SELFHOSTED_URL=https://<RUNPOD_POD_ID>-8080.proxy.runpod.net/chat/completions
STAR_SELFHOSTED_MODEL=gpt-oss:20b
STAR_SELFHOSTED_TOKEN=<PRIVATE_MATCHING_TOKEN>
```

Set `STAR_SELFHOSTED_TOKEN` as an encrypted secret, not a public environment variable. The token must match Runpod's private Pod environment. Re-deploy Pages, log in as STAR Owner, test an ordinary chat and verify the model id in the response. To roll back, reset `STAR_AI_PROVIDER` to the prior provider, keeping its API secret in place.

**Do not** commit sensitive tokens, email-login links, Runpod API keys or container registry credentials.

## Status boundaries

- ✓ STAR Runpod image build workflow/config included in GitHub.
- ✓ STAR owner-only AI gateway, tests, Supabase memory and Cloudflare website remain independent.
- ⚠ Runpod account OAuth has to be completed by the account owner and verified by listing Pods.
- ⚠ A real GPU Pod is **not** created by the build pipeline.
- ⚠ Cloudflare switch is intentionally deferred until the Pod health and chat tests succeed.
