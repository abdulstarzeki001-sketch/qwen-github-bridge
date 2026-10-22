# RunPod GPU Pod: STAR independent brain (one container)

This deployment mode is for **RunPod Pods** (containers), unlike the sibling GPU VM `compose.yaml`. It uses a single Docker image bundling Ollama + an authenticated Node inference gateway. It does not require a Docker daemon inside the running RunPod Pod.

## Use the prebuilt STAR image (recommended)

The STAR GitHub Actions workflow builds and publishes an image at:

```text
ghcr.io/abdulstarzeki001-sketch/star-independent-ai:latest
```

[STAR RunPod build workflow](https://github.com/abdulstarzeki001-sketch/qwen-github-bridge/actions/workflows/runpod-image.yml).

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

## Create the RunPod Pod

1. Open [RunPod](https://www.runpod.io/) and create a GPU Pod (this **incurs charges**).
2. Choose **RTX A5000 24 GB** or other Nvidia GPU with at least 24 GB VRAM (availability/performance vary).
3. Select the published `ghcr.io/abdulstarzeki001-sketch/star-independent-ai:latest` (if its package is public), or your own `YOUR_DOCKERHUB_USER/star-independent-ai:1` image.
4. Expose **8080 HTTP** in the RunPod Pod networking settings (`8080/http`). **Do NOT expose port 11434**, which is Ollama's unauthenticated local API.
5. Set `STAR_BACKEND_TOKEN` to a long random value (generate on your own device using `openssl rand -hex 32`), and optionally `STAR_MODEL=gpt-oss:20b`. These go in the Pod's **private environment settings**, not in source code.
6. Create a persistent Pod volume mounted at `/workspace` with at least 40 GB capacity (>=60 GB recommended). It stores model weights so they aren't redownloaded on restart; review provider storage guarantees.
7. Start the Pod. The first start downloads model weights (~14GB). The gateway only starts accepting requests after model download succeeds.
8. Find Pod ID in RunPod console. The externally accessible HTTPS address follows RunPod's documented pattern:
   `https://YOUR_POD_ID-8080.proxy.runpod.net/chat/completions`.
9. With a private token, test `/health` and `/chat/completions` before using this URL as the STAR backend. Unauthorized public requests must return `401`.

## Connect the STAR website

In Cloudflare Pages project `star-cyber-ai-x`, set:

```ini
STAR_AI_PROVIDER=selfhosted
STAR_SELFHOSTED_URL=https://YOUR_POD_ID-8080.proxy.runpod.net/chat/completions
STAR_SELFHOSTED_MODEL=gpt-oss:20b
STAR_SELFHOSTED_TOKEN=<the same random token; ENCRYPTED secret in Cloudflare>
```

Redeploy Pages after verifying the Pod; changes to `STAR_AI_PROVIDER` are **not** automatic. STAR's owner-only Cloudflare Function includes the bearer token on requests; the browser and iPhone never receive it.

This Pod deployment uses **RunPod's HTTPS proxy** for backend HTTPS, so you do not need a Cloudflare Tunnel or your own domain. The frontend still runs on Cloudflare Pages. If your Pod ID changes, update the endpoint in Cloudflare settings.

## Notes

- Cost runs while the Pod is active; a dedicated GPU 24/7 has significant monthly charges in addition to storage.
- The Pod is *rented hardware*; you control the model weights and deployment, but RunPod owns the physical infrastructure.
- Do not post the bearer token, screenshots with tokens, a `.env` file, or SSH private keys.
- Regularly patch and rebuild the image; this reference uses `latest` for Ollama and should be pinned to tested digests before production.
- For a VM where you control Docker directly, see [the parent instructions](../README.md). That route uses Cloudflare Tunnel and no public exposed port.
