#!/bin/bash
set -euo pipefail

if [[ "${#STAR_BACKEND_TOKEN}" -lt 32 ]]; then
  echo "Set STAR_BACKEND_TOKEN in RunPod Pod environment (minimum 32 chars)" >&2
  exit 1
fi
export OLLAMA_HOST=127.0.0.1:11434
export OLLAMA_MODELS=${OLLAMA_MODELS:-/workspace/ollama}
export STAR_MODEL=${STAR_MODEL:-gpt-oss:20b}
export OLLAMA_ENDPOINT=http://127.0.0.1:11434/v1/chat/completions
mkdir -p "${OLLAMA_MODELS}"

/bin/ollama serve &
ollama_pid=$!
cleanup(){
  kill "${gateway_pid:-0}" "${ollama_pid}" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

# The model weights are stored on /workspace (persistent RunPod volume).
for i in {1..60}; do
  if /bin/ollama list >/dev/null 2>&1; then break; fi
  sleep 2
done
/bin/ollama pull "${STAR_MODEL}"

/usr/local/bin/node /opt/star/gateway.mjs &
gateway_pid=$!
wait -n "${ollama_pid}" "${gateway_pid}"
