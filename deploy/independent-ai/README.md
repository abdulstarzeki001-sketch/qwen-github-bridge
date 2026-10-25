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

## STAR NEXUS V5 — use multiple Ollama models through one protected gateway

This runtime now integrates **Qwen2.5 Coder**, **Drana-Infinity**, and **gpt-oss** with one private Ollama server and one authenticated STAR gateway. None is the original WormGPT model.

1. Configure `STAR_ALLOWED_MODELS` in the GPU host's `.env` (the supplied example includes three models). `STAR_MODEL` must be one of them.
2. Start the private GPU stack with `docker compose up -d`. No Ollama or gateway ports are exposed directly.
3. Download the selected models onto the persistent volume: `bash pull-models.sh` (this downloads multiple GB of model weights; verify storage and licensing first).
4. Keep the **same allowlist** in Cloudflare Pages environment as `STAR_ALLOWED_MODELS`, with `STAR_SELFHOSTED_URL`, `STAR_SELFHOSTED_MODEL` and secret `STAR_SELFHOSTED_TOKEN` pointing at your working gateway. The model picker only offers entries approved on the server.
5. A private owner endpoint `/api/nexus/models` returns the allowlist, and `/api/nexus/model-probe` checks authenticated `/health` reachability for the private provider. This does not claim model inference is available until you also send a successful chat.

### Primary terminal executor: Open Interpreter

Open Interpreter is the primary coding and command execution engine for the private GPU stack. It is installed from the official standalone release `0.0.56`; the upstream installer source is pinned to a Git commit and verifies the release archive checksum. It uses the existing local Ollama service and defaults to the `qwen2.5-coder:7b` model.

From this directory, first build the on-demand executor image:

```sh
docker compose --profile interpreter build interpreter
```

Copy only the project files you want it to access into `agent-workspace/`, then start an interactive session:

```sh
docker compose --profile interpreter run --rm interpreter
```

Type a task in the terminal. Open Interpreter can inspect and edit files under `agent-workspace/` and run commands there. Its defaults use the workspace-write sandbox and ask for approval when needed. The container gets no Cloudflare, GitHub, or production credentials. Its private internal network can reach Ollama but blocks direct internet egress. It starts only when launched and is not exposed as an HTTP endpoint or wired to Cloudflare Pages chat.

Do not copy secrets, production data, or unrelated personal files into `agent-workspace/`. To stop the session, use `Ctrl-C`; the named `interpreter-home` volume keeps local CLI state between runs.

**Runtime preconditions:** your own paid/owned persistent NVIDIA GPU VM, working Docker + GPU toolkit, model storage, Cloudflare Tunnel hostname, and secrets. GitHub Actions performs build checks on disposable runners; it does not host these containers permanently.

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

## Open Interpreter from the STAR website

The site now has an owner-only page at `/open-interpreter.html`. Start the isolated executor on the GPU host:

```sh
docker compose --profile interpreter up -d --build interpreter-web
```

The service runs Open Interpreter with the local Ollama model and the dedicated `agent-workspace/`. It has no direct Internet egress, receives no STAR credentials, accepts one task at a time, and stops tasks after 85 seconds.

After the HTTPS Cloudflare Tunnel hostname is routed to the STAR gateway, set these in Cloudflare Pages production:

```ini
STAR_INTERPRETER_URL=https://ai.your-owned-domain.tld/interpreter/execute
STAR_INTERPRETER_TOKEN=<same secret as STAR_BACKEND_TOKEN on the GPU host>
```

Keep the token as a Pages secret. Workspace changes stay on the GPU host and are not published automatically. Without a running GPU host and both Pages variables, the UI reports that the executor is disconnected.
