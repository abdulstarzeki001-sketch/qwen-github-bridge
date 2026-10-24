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
