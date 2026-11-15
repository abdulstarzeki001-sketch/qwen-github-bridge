#!/usr/bin/env bash
# Pull the explicitly configured allowlisted model weights to the private Ollama volume.
# Call only on a persistent GPU host after 'docker compose up -d ollama'.
set -euo pipefail
cd "$(dirname "$0")"
test -f .env || { echo "Create .env from .env.example first" >&2; exit 2; }
command -v docker >/dev/null || { echo "Docker is required" >&2; exit 2; }
docker compose config --quiet
models="$(docker compose config --format json | python3 -c '
import sys,json
obj=json.load(sys.stdin)
models=obj["services"]["gateway"]["environment"]["STAR_ALLOWED_MODELS"]
print(models)
')"
IFS=',' read -ra choices <<< "$models"
if (("${#choices[@]}"<1 || "${#choices[@]}">12)); then echo "Invalid model count" >&2; exit 2; fi
for name in "${choices[@]}"; do
 name="$(echo "$name" | xargs)"
 if [[ ! "$name" =~ ^[A-Za-z0-9._:/-]{3,120}$ ]]; then echo "Invalid model name" >&2; exit 2; fi
 echo "Pulling STAR Ollama model: $name"
 docker compose exec -T ollama ollama pull "$name"
done
echo "Model inventory:"
docker compose exec -T ollama ollama list
echo "Configured STAR models are downloaded to the persistent Ollama volume."
