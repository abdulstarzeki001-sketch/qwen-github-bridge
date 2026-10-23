# 01 — WormGPTv2 CLI execution in STAR

Upstream: https://github.com/WormGPTv2/wormgpt

**What it is:** a Node CLI coding agent with user-selected models. It is not original WormGPT 2023 weights, nor a persistent HTTP inference host.

## Verify and install CLI on Mac/Linux

Requires Node >=22, npm, curl, sha256sum. From the STAR checkout:

```sh
bash integrations/wormgptv2/bootstrap.sh
```

This obtains pinned upstream GitHub release v0.22.0, verifies the published SHA-256 `4b4668f8e00a41fc7780c368a22dfc268dd9cf5aa74dd73230de96ed5093a0fd`, validates package metadata, installs to `.integrations/wormgptv2/` with lifecycle scripts disabled, and runs actual CLI `--version`. Does not install globally.

## Start an interactive coding agent with Ollama

1. Install Ollama from https://ollama.com/download on your own Mac/Linux machine.
2. Run `ollama pull qwen2.5-coder:7b` and ensure Ollama is serving locally.
3. From a disposable or backup checkout, start:

```sh
STAR_LOCAL_MODEL=qwen2.5-coder:7b bash integrations/wormgptv2/run-local.sh
```

Shell and GitHub write privileges remain gated by agent approval settings. Review changes before committing/pushing.

## CI verification

The workflow `.github/workflows/verify-upstreams.yml` runs the real upstream CLI with `--version` on an ephemeral GitHub Actions runner, then the WormXGPT frontend build as job 02. Neither requires a model API key, but these are **startup/build smoke tests**, not proof that an interactive AI conversation is available from an iPhone.

## Notes

The separate npm package named `wormgpt-cli` has a malware advisory; **do not install it**. File integrity only proves package identity, not safety. Cloudflare Pages cannot execute a Node terminal coding agent persistently.
