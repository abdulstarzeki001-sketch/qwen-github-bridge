# Runpod GPU Pod: STAR independent brain (one container)

This deployment mode is for **Runpod Pods** (containers), unlike the sibling GPU VM `compose.yaml`. It uses a single Docker image bundling Ollama + an authenticated Node inference gateway. It does not require a Docker daemon inside the running Runpod Pod.

## Prebuilt STAR container (preferred)

GitHub Actions publishes STAR's own inference container as:

```text
ghcr.io/abdulstarzeki001-sketch/star-independent-ai:latest
```

[See the image-build workflow](https://github.com/abdulstarzeki001-sketch/qwen-github-bridge/actions/workflows/publish-star-runpod-image.yml).

Before using it with Runpod, verify that the build succeeded and that the **GHCR package is publicly pullable** (or configure private registry access in Runpod). Public GitHub repository visibility does not automatically make the GHCR package public.

In Runpod, select this custom image instead of the example Docker Hub image below. Do not put passwords or API tokens in the container image.

## Build a container image manually (alternative)

On a computer with Docker, clone the STAR repository and run:

```sh
docker build -f deploy/independent-ai/runpod/Dockerfile \
  -t YOUR_DOCKERHUB_USER/star-independent-ai:1 \
  deploy/independent-ai
docker push YOUR_DOCKERHUB_USER/star-independent-ai:1
```

You must log in to your container registry before pushing, and the image must be accessible by Runpod (public, or private with registry credentials configured). Never bake tokens into the image.

## Create the Runpod Pod

1. Open [Runpod](https://www.runpod.io/) and create a GPU Pod (this **incurs charges**).
2. Choose **RTX A5000 24 GB** or other Nvidia GPU with at least 24 GB VRAM (availability/performance vary).
3. Select `ghcr.io/abdulstarzeki001-sketch/star-independent-ai:latest` if publicly pullable, or use your custom registry image `YOUR_DOCKERHUB_USER/star-independent-ai:1`.
4. Expose **8080 HTTP** in the Runpod Pod networking settings (`8080/http`). **Do NOT expose port 11434**, which is Ollama's unauthenticated local API.
5. Set `STAR_BACKEND_TOKEN` to a long random value (generate on your own device using `openssl rand -hex 32`), and optionally `STAR_MODEL=gpt-oss:20b`. These go in the Pod's **private environment settings**, not in source code.
6. Create a persistent Pod volume mounted at `/workspace` with at least 40 GB capacity (>=60 GB recommended). It stores model weights so they aren't redownloaded on restart; review provider storage guarantees.
7. Start the Pod. The first start downloads model weights (~14GB). The gateway only starts accepting requests after model download succeeds.
8. Find Pod ID in Runpod console. The externally accessible HTTPS address follows Runpod's documented pattern:
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

This Pod deployment uses **Runpod's HTTPS proxy** for backend HTTPS, so you do not need a Cloudflare Tunnel or your own domain. The frontend still runs on Cloudflare Pages. If your Pod ID changes, update the endpoint in Cloudflare settings.

## Notes

- Cost runs while the Pod is active; a dedicated GPU 24/7 has significant monthly charges in addition to storage.
- The Pod is *rented hardware*; you control the model weights and deployment, but Runpod owns the physical infrastructure.
- Do not post the bearer token, screenshots with tokens, a `.env` file, or SSH private keys.
- Regularly patch and rebuild the image; this reference uses `latest` for Ollama and should be pinned to tested digests before production.
- For a VM where you control Docker directly, see [the parent instructions](../README.md). That route uses Cloudflare Tunnel and no public exposed port.
