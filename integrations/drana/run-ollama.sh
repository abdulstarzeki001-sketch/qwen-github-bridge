#!/usr/bin/env bash
# Execute only on your own machine with an installed Ollama runtime.
set -euo pipefail
command -v ollama >/dev/null || { echo 'Install Ollama first: https://ollama.com/download' >&2; exit 1; }
model="$(printenv STAR_DRANA_MODEL || printf 'IHA089/drana-infinity-3b:3b')"
case "$model" in
  IHA089/drana-infinity-1.5b:1.5b|IHA089/drana-infinity-3b:3b|IHA089/drana-infinity-7b:7b) ;;
  *) echo 'Unsupported Drana model' >&2; exit 2 ;;
esac
ollama pull "$model"
ollama show "$model" >/dev/null
echo "Starting local Drana model: $model"
exec ollama run "$model"
