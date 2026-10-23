#!/bin/bash
set -euo pipefail

BACKEND_TOKEN="${STAR_BACKEND_TOKEN:-}"
if [[ "${#BACKEND_TOKEN}" -lt 32 || "${#BACKEND_TOKEN}" -gt 256 ]]; then
  echo "Set STAR_BACKEND_TOKEN in RunPod Pod environment (minimum 32 chars)" >&2
  exit 1
fi
export OLLAMA_HOST=127.0.0.1:11434
export OLLAMA_MODELS=${OLLAMA_MODELS:-/workspace/ollama}
source /opt/star/model-config.sh
validate_star_model_config
export OLLAMA_ENDPOINT=http://127.0.0.1:11434/v1/chat/completions
mkdir -p "${OLLAMA_MODELS}"

/bin/ollama serve &
ollama_pid=$!
cleanup(){
  if [[ -n "${gateway_pid:-}" ]]; then kill "$gateway_pid" 2>/dev/null || true; fi
  kill "$ollama_pid" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

# The model weights are stored on /workspace (persistent RunPod volume).
ollama_ready=0
for i in {1..60}; do
  if /bin/ollama list >/dev/null 2>&1; then ollama_ready=1; break; fi
  if ! kill -0 "$ollama_pid" 2>/dev/null; then echo "Ollama stopped before readiness" >&2; exit 1; fi
  sleep 2
done
if [[ "$ollama_ready" != 1 ]]; then echo "Ollama did not become ready" >&2; exit 1; fi

# Every selectable model is downloaded BEFORE the gateway begins accepting requests.
# Restrict STAR_ALLOWED_MODELS if you have limited GPU disk capacity.
for model in "${STAR_MODEL_LIST[@]}"; do
  echo "Preparing STAR model: $model"
  /bin/ollama pull "$model"
done
echo "Ollama model inventory ready: ${#STAR_MODEL_LIST[@]} approved model(s)."

/usr/local/bin/node /opt/star/gateway.mjs &
gateway_pid=$!
wait -n "${ollama_pid}" "${gateway_pid}"
