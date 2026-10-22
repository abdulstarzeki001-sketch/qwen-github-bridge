# Runpod Agent Onboarding — STAR AI

Official source checked: https://agents.runpod.io/ and https://docs.runpod.io/get-started/agent-skills (October 22, 2026).

The STAR repository has a Codex installer for the **owner's own computer** and the existing secured Runpod GPU Docker deployment in deploy/independent-ai/runpod/.

## Install on a Mac with Codex

Requirements: Node.js 22.20 or newer, npx, and Codex CLI.

~~~bash
node --version
bash scripts/setup-runpod-codex.sh
~~~

The script installs official skills for Codex only (not all agents) and registers the Runpod plugin, with direct MCP fallback. Commands are based on the verified setup guide:

~~~bash
npx -y skills add runpod/runpod-plugins-official --skill '*' --agent codex --yes --global
codex plugin marketplace add https://github.com/runpod/runpod-plugins-official.git
codex plugin add runpod@runpod
# Only if the above plugin cannot be registered:
codex mcp add runpod --url https://mcp.runpod.io/
~~~

**Owner action required:** fully restart Codex / Codex Desktop, approve OAuth **Sign in with Runpod** when prompted, then ask **List my Runpod Pods** to verify the connected account. An empty list can be success if there are no Pods. Never paste credentials into GitHub or chat.

## Deploy the STAR GPU Pod

1. Open https://console.runpod.io/deploy and sign in to your own account. The available browser showed an authentication dialog and no authenticated access.
2. Use the STAR custom image when published: ghcr.io/abdulstarzeki001-sketch/qwen-github-bridge-gpu:latest (the project workflow publishes it). **GHCR image must be public**, or registry credentials must be provided in Runpod.
3. Choose NVIDIA GPU with >=24GB VRAM for initial gpt-oss:20b deployment. Verify current prices in the console before confirming a charge.
4. Expose port **8080/http only**, NEVER raw Ollama port 11434.
5. Allocate >=40GB persistent /workspace storage (60GB recommended).
6. Configure a long random STAR_BACKEND_TOKEN securely in the Pod environment and STAR_MODEL=gpt-oss:20b. Do not embed the token into public source or user-visible chat.
7. After Pod health and inference are tested, set Cloudflare Pages backend variables: STAR_AI_PROVIDER=selfhosted, STAR_SELFHOSTED_URL=https://YOUR_POD_ID-8080.proxy.runpod.net/chat/completions, STAR_SELFHOSTED_MODEL=gpt-oss:20b, STAR_SELFHOSTED_TOKEN as an encrypted secret with the same value.
8. Redeploy STAR Pages only after the GPU model actually works. Never switch production prematurely.

See deploy/independent-ai/runpod/README.md for detailed container operations.

## Verified status

- Official Runpod agent guide read.
- In the available browser, Runpod deploy required a user login; **no Pod created, no charge incurred**.
- No Runpod connector was available inside the ChatGPT plugin directory during setup.
- The temporary code environment had Node.js 22.16 and no Codex CLI; the installer was not run on the user's machine, and OAuth could not be completed on their behalf.
- Repository setup is ready. GPU deployment and account authorization require the owner.
