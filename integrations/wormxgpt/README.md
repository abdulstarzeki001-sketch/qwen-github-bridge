# 02 — WormXGPT React frontend

Upstream: https://github.com/gaur-avvv/wormxgpt

This is a **Vite/React frontend + optional CLI** rather than the original WormGPT model weights. The upstream source is pinned to commit `d4abdb4c782d3489d5b107b072c01217d53e9396` in the STAR isolated upstream verification workflow.

Job 02 executes **only after** the WormGPTv2 CLI smoke job 01 passes:

```sh
git clone https://github.com/gaur-avvv/wormxgpt.git
cd wormxgpt
git checkout --detach d4abdb4c782d3489d5b107b072c01217d53e9396
npm install --ignore-scripts --no-audit --no-fund
npm run build
```

When successful, GitHub Actions creates `wormxgpt-frontend-static` for inspection and independent deployment. The build output is not blindly copied into STAR's authenticated origin; it includes third-party browser code and needs its own hostname or strict sandboxing and an audit of model-key storage.

To run development locally, use an isolated checkout and restrict the Vite server to localhost:

```sh
npm run dev -- --host 127.0.0.1
```

STAR NEXUS already contains an independent mobile-first chat powered by STAR's owner-authenticated `/api/chat`. This upstream build is for evaluating whether WormXGPT can add useful agent and MCP features without weakening that boundary.

No secrets should be provided to this upstream CI build; some features still need remote providers and MCP services.
