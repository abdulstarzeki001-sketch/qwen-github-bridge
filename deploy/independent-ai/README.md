# STAR AI — independent GPU brain

This package prepares a **self-controlled inference service** powered by local model weights. It does **not** rent or buy a GPU or modify your deployed STAR cloud provider.

## Architecture

```
Trusted iPhone / Desktop
  -> STAR AI Cloudflare Pages (owner-authenticated /api/chat)
  -> HTTPS private inference hostname, bearer token held only in Cloudflare secrets
  -> Cloudflare Tunnel (outbound-only from GPU host)
  -> STAR Gateway (Node; bearer authentication, bounded requests; no chat logging)
  -> Ollama (internal container only; gpt-oss:20b weights on persistent volume)
```

Nothing in this directory publishes a TCP inference port on the GPU host; Ollama is only reachable from the Docker bridge. Do NOT route your tunnel directly to Ollama: its local API does not have authentication. The gateway authenticates requests before proxying.

**RunPod GPU Pod option:** use the [dedicated single-container RunPod instructions](runpod/README.md) instead. This avoids needing Docker Compose within the Pod and uses RunPod HTTPS proxy for the endpoint. No Cloudflare Tunnel or custom domain is required for that variant.

## Minimum dedicated GPU

- A full GPU Linux VM you control with **one NVIDIA GPU with 24 GB VRAM**, Ubuntu 22.04/24.04 or equivalent, Docker Engine + Compose plugin + NVIDIA Container Toolkit already working.
- GPU compute requirements vary with quantization, context, driver and model. `gpt-oss:20b` in Ollama is ~14 GB download and can run in approximately 16 GB of model memory, but 24 GB GPU VRAM is a safer initial target.
- Persistent disk >= 40 GB recommended to hold Ollama weights and runtime.
- This **Docker Compose path requires a GPU VM with Docker access**. RunPod Pods are containers and do not necessarily expose a Docker daemon or allow this Compose setup. For RunPod Pod specifically, you will need an appropriate single-container image/template and provider-level HTTPS exposed port or install a supported environment first. Do **not** attempt to run this Compose directly inside a standard RunPod Pod without checking Docker and NVIDIA GPU support. A full GPU VM provider is the direct match.

## Setup on your own GPU Linux VM (no secret goes into GitHub)

1. Install Docker, Docker Compose v2 plugin, NVIDIA drivers and [NVIDIA Container Toolkit](https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/latest/install-guide.html). Verify `nvidia-smi` and `docker info`.
2. Check out your STAR GitHub repository and enter the folder:

```sh
git clone https://github.com/abdulstarzeki001-sketch/qwen-github-bridge.git
cd qwen-github-bridge/deploy/independent-ai
cp .env.example .env
chmod 600 .env
openssl rand -hex 32
```

3. Put the generated random token into `STAR_BACKEND_TOKEN` inside **this GPU server's** `.env`. Do not paste it in tickets, screenshots or chat. The same value is needed later in Cloudflare as a secret.
4. From [Cloudflare Zero Trust → Networks → Tunnels](https://one.dash.cloudflare.com/), create a remotely managed tunnel, assign its **public hostname** (example `ai.your-owned-domain.tld`) to `http://gateway:8080`, and save the tunnel token as `CF_TUNNEL_TOKEN` in the server `.env`. This step requires control of a domain in Cloudflare. An existing `.pages.dev` hostname cannot simply be reused as the Tunnel hostname.
5. Run:

```sh
docker compose config --quiet
docker compose up -d
docker compose exec ollama ollama pull gpt-oss:20b
docker compose exec ollama ollama list
docker compose logs --tail=50 gateway tunnel
```

6. Verify the gateway using the **secret from the local server environment**, without pasting it into a command copied to shared logs. Example after `source .env` in a shell that you control (do not leave secrets in shell history):

```sh
set -a; . ./.env; set +a
curl --fail --silent -H "Authorization: Bearer ${STAR_BACKEND_TOKEN}" https://ai.your-owned-domain.tld/health
curl --fail --silent -H "Authorization: Bearer ${STAR_BACKEND_TOKEN}" -H "Content-Type: application/json" \
  https://ai.your-owned-domain.tld/chat/completions \
  -d '{"model":"gpt-oss:20b","messages":[{"role":"user","content":"Say hello"}],"max_tokens":128,"temperature":0.2}'
```

7. **Only when the gateway responds correctly**, add these to the *STAR Cloudflare Pages project* settings (production Environment Variables/Secrets):

```ini
STAR_AI_PROVIDER=selfhosted
STAR_SELFHOSTED_URL=https://ai.your-owned-domain.tld/chat/completions
STAR_SELFHOSTED_MODEL=gpt-oss:20b
STAR_SELFHOSTED_TOKEN=<the SAME long random token from the GPU server, saved as encrypted secret>
```

Never put `STAR_SELFHOSTED_TOKEN` in a public HTML page, GitHub commit, Pages source, or browser setting. The server's .env is excluded by gitignore. **Do not change** `STAR_AI_PROVIDER` until inference works: production will otherwise display errors.

8. Redeploy STAR Pages and log in as its owner from iPhone. STAR's backend will contact your model using the existing owner-only `/api/chat`. The iPhone never receives the server's backend token.

## Operate

- `docker compose ps` — see services.
- `docker compose logs --tail=100 gateway` — gateway status without chat content.
- `docker compose exec ollama ollama ps` — see loaded models.
- `docker compose exec ollama ollama pull gpt-oss:20b` — refresh model on purpose.
- `docker compose down` — stop services; named `ollama-models` volume survives. **Do not use** `docker compose down -v` unless you intentionally want to delete local weights.
- Arrange VM snapshots and backups; provider storage may be erased on shutdown or termination.
- Prefer pinning production image digests to tested versions after first working deployment. `latest` is a bootstrap default, not reproducible.
- Budget for always-on GPU billing, persistent storage, provider egress, and downtime; no provider promises 100% uptime.
- The model's license and learned behavior remain in force. Self-hosting does not guarantee obedience to every request.

## Security

- Never publicly expose port 11434 (unauthenticated Ollama) or port 8080 without gateway token protection.
- Tunnel `http://gateway:8080` uses Docker networking, with public TLS provided by Cloudflare.
- The gateway supports **only** POST `/chat/completions` and authenticated GET `/health`; all other paths rejected.
- The gateway only passes a specified allowed model (`STAR_MODEL`) and validates message counts and length.
- Limit server SSH access using SSH keys, firewall rules and updates. Do not install arbitrary scripts, unverified model binaries or expose SSH passwords.
- Use the existing STAR owner authentication and Cloudflare rate limiting. Monitor bandwidth/compute usage.
- API access is contingent on availability of the GPU server and tunnel; keep your current provider available as a *manual rollback* until testing is complete.

## Documentation
- [OpenAI open models](https://openai.com/open-models/)
- [Ollama gpt-oss](https://ollama.com/library/gpt-oss)
- [Cloudflare Tunnel guide](https://developers.cloudflare.com/tunnel/get-started/)
- [Docker NVIDIA GPU compose](https://docs.docker.com/compose/how-tos/gpu-support/)
