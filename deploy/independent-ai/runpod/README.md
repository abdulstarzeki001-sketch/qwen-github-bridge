# RunPod GPU Pod: STAR independent brain (one container)

This deployment mode is for **RunPod Pods** (containers), unlike the sibling GPU VM `compose.yaml`. It uses a single Docker image bundling Ollama + an authenticated Node inference gateway. It does not require a Docker daemon inside the running RunPod Pod.

## Use the prebuilt STAR image (recommended)

The STAR GitHub Actions workflow builds and publishes an image at:

```text
ghcr.io/abdulstarzeki001-sketch/star-independent-ai:latest
```

[STAR RunPod build workflow](https://github.com/abdulstarzeki001-sketch/qwen-github-bridge/actions/workflows/publish-star-runpod-image.yml).

**Important:** GitHub Container Registry packages may start out private. Open the package settings in the repository owner's GitHub account and set its **package visibility to Public**, or configure supported RunPod private-registry credentials securely. A public *container image* contains only public source and no personal API keys; all model/server credentials are supplied by RunPod environment secrets at runtime.

If the GitHub Actions image has not completed a successful build yet, follow the manual build below.

## Build a container image yourself (fallback)

On a computer with Docker, clone the STAR repository and run:

```sh
docker build -f deploy/independent-ai/runpod/Dockerfile \
  -t YOUR_DOCKERHUB_USER/star-independent-ai:1 \
  deploy/independent-ai
docker push YOUR_DOCKERHUB_USER/star-independent-ai:1
```

You must log in to your container registry before pushing, and the image must be accessible by RunPod (public, or private with registry credentials configured). Never bake tokens into the image.

## STAR NEXUS V6 — verified image and multi-model boot

[Image publishing run — succeeded on 2026-10-23](https://github.com/abdulstarzeki001-sketch/qwen-github-bridge/actions/runs/40001489623).

The published image is **only** a container distribution. It does not prove that a GPU Pod was started or that model inference is reachable. The RunPod template/pod and Cloudflare secret variables still need to be configured. A newly created GHCR package may be private even when the repository is public; enable public package visibility or configure registry authentication.

**New model behavior:** RunPod validates `STAR_MODEL` and a comma-separated `STAR_ALLOWED_MODELS` (1–12 distinct models, including the default). It downloads **every listed model before the gateway opens port 8080**. For a first deployment, use one model to minimize disk, startup time and GPU costs:

```ini
STAR_MODEL=qwen2.5-coder:7b
STAR_ALLOWED_MODELS=qwen2.5-coder:7b
```

After the first working request, a larger persistent disk can be used for:

```ini
STAR_MODEL=gpt-oss:20b
STAR_ALLOWED_MODELS=gpt-oss:20b,qwen2.5-coder:7b,IHA089/drana-infinity-3b:3b
```

Allocate adequate disk space for all weights (60–100 GB or more depending on the models) and leave enough GPU VRAM. Ollama runs one model at a time on the 24 GB bootstrap configuration, so switching may trigger a model unload/reload. Model releases, their terms, and hardware needs can change. Do not assume a selected model is ready until you receive an actual chat response.

## Automated Pod management with RunPod REST API v2

To bridge the final gap between a **published Docker image** and a **running, billable GPU Pod**, this repo includes an owner-controlled RunPod API v2 tool: `scripts/runpod-control.mjs`.

**Option 1 (GitHub Actions, iPhone-friendly):**
Open [RunPod GPU Control](https://github.com/abdulstarzeki001-sketch/qwen-github-bridge/actions/workflows/runpod-gpu-control.yml) → **Run workflow**.
`plan` requires no API key or money and previews the exact Pod configuration.
`list` uses the `RUNPOD_API_KEY` Actions secret to discover the Pods already in your own RunPod account.
`create` requires `RUNPOD_API_KEY`, `STAR_BACKEND_TOKEN` in **GitHub Actions secrets**, plus explicit `CREATE_PAID_GPU` confirmation. It creates exactly one 8080/http Pod only on an explicit manual run, and returns the Pod ID. It does **not** fund your account, verify GHCR package visibility, update Cloudflare secrets, or automatically retry a failed or uncertain creation response. You may be charged for Pod usage, storage, and related resources. A missing balance can produce HTTP 402.

**Option 2 (private terminal):**

```sh
node scripts/runpod-control.mjs plan
# Export RUNPOD_API_KEY in your own terminal or a secret manager (never commit it).
node scripts/runpod-control.mjs list
# Only after confirming budget, GPU availability and GHCR image access:
node scripts/runpod-control.mjs create --confirm-paid --gpu "NVIDIA GeForce RTX 4090" --model qwen2.5-coder:7b --volume 60
```

The script uses `https://api.runpod.io/v2/pods` rather than deprecated REST v1, and excludes API tokens and environment secrets from printed output. It does not print logs from RunPod containing secrets. API-key permissions and GPU resource availability determine whether creation succeeds. Current v2 docs: https://docs.runpod.io/api-reference-v2/pods/create-a-pod .

**Important:** The GitHub Actions paid-create workflow checks anonymous GHCR image pull before creating a Pod. If `ghcr.io/abdulstarzeki001-sketch/star-independent-ai:latest` is private, RunPod cannot pull it anonymously. Change GHCR package visibility through your GitHub account or add an approved private registry credential in RunPod before creating a billable Pod.

## No credits or no GPU available?

Continue using the existing Cloudflare Workers AI path. With Workers AI `AI` Binding configured, set `STAR_AI_PROVIDER=cloudflare` in Cloudflare Pages and redeploy. This serves a Cloudflare-hosted model instead of a self-owned GPU model, and provider usage limits still apply. **It does not activate the WormGPTv2 CLI or train local weights.** Do not change `STAR_AI_PROVIDER` to `selfhosted` until `node scripts/verify-runpod.mjs` passes an actual completion.

## Create the RunPod Pod

1. Open [RunPod](https://www.runpod.io/) and create a GPU Pod (this **incurs charges**).
2. Choose **RTX A5000 24 GB** or other Nvidia GPU with at least 24 GB VRAM (availability/performance vary).
3. Select the published `ghcr.io/abdulstarzeki001-sketch/star-independent-ai:latest` (if its package is public), or your own `YOUR_DOCKERHUB_USER/star-independent-ai:1` image.
4. Expose **8080 HTTP** in the RunPod Pod networking settings (`8080/http`). **Do NOT expose port 11434**, which is Ollama's unauthenticated local API.
5. Set `STAR_BACKEND_TOKEN` to a long random value (generate on your own device using `openssl rand -hex 32`), and `STAR_MODEL` plus optional `STAR_ALLOWED_MODELS`. These go in the Pod's **private environment settings**, not in source code.
6. Create a persistent Pod volume mounted at `/workspace` (>=40 GB for a one-model test; 60–100 GB or more when using three models). It stores model weights so they aren't redownloaded on restart; review provider storage guarantees.
7. Start the Pod. The first start downloads the selected model weights (sizes vary). The gateway only starts accepting requests after all allowlisted model downloads succeed.
8. Find Pod ID in RunPod console. The externally accessible HTTPS address follows RunPod's documented pattern:
   `https://YOUR_POD_ID-8080.proxy.runpod.net/chat/completions`.
9. From your checked-out STAR project, run the verification script below **before** changing Cloudflare provider settings. Anonymous `/health` must return `401`, authorized health must return a valid model list, and the short inference request must return non-empty content:

```sh
export STAR_RUNPOD_ENDPOINT="https://YOUR_POD_ID-8080.proxy.runpod.net/chat/completions"
read -rs STAR_BACKEND_TOKEN; echo
export STAR_BACKEND_TOKEN
node scripts/verify-runpod.mjs
unset STAR_BACKEND_TOKEN
```

To only check health (without triggering paid inference), append `--health-only`. The verifier prints status and model identifiers but never prints the secret or the generated answer. It reports `inference_checked:true` only after a real completion. On startup, RunPod's proxy may give a temporary 502 while downloading models; inspect the Pod logs for pull failures, storage shortages or missing GPU support.

## Connect the STAR website

In Cloudflare Pages project `star-cyber-ai-x`, set:

```ini
STAR_AI_PROVIDER=selfhosted
STAR_SELFHOSTED_URL=https://YOUR_POD_ID-8080.proxy.runpod.net/chat/completions
STAR_SELFHOSTED_MODEL=gpt-oss:20b
STAR_ALLOWED_MODELS=gpt-oss:20b,qwen2.5-coder:7b,IHA089/drana-infinity-3b:3b
STAR_SELFHOSTED_TOKEN=<the same random token; ENCRYPTED secret in Cloudflare>
```

Redeploy Pages after verifying the Pod; changes to `STAR_AI_PROVIDER` are **not** automatic. STAR's owner-only Cloudflare Function includes the bearer token on requests; the browser and iPhone never receive it.

This Pod deployment uses **RunPod's HTTPS proxy** for backend HTTPS, so you do not need a Cloudflare Tunnel or your own domain. The frontend still runs on Cloudflare Pages. If your Pod ID changes, update the endpoint in Cloudflare settings.

## iPhone setup page

Open [STAR GPU deployment guide](https://star-cyber-ai-x.pages.dev/gpu-deploy.html) on iPhone or iPad. It generates the standard proxy URL locally from your Pod ID, lists the Cloudflare variables, and checks the authenticated gateway after owner login. It does **not** create a paid Pod, handle your secret or automatically reconfigure Cloudflare.

## Notes

- Cost runs while the Pod is active; a dedicated GPU 24/7 has significant monthly charges in addition to storage.
- The Pod is *rented hardware*; you control the model weights and deployment, but RunPod owns the physical infrastructure.
- Do not post the bearer token, screenshots with tokens, a `.env` file, or SSH private keys.
- Regularly patch and rebuild the image; this reference uses `latest` for Ollama and should be pinned to tested digests before production.
- For a VM where you control Docker directly, see [the parent instructions](../README.md). That route uses Cloudflare Tunnel and no public exposed port.
