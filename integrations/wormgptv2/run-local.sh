#!/usr/bin/env bash
# Start WormGPTv2 CLI backed by an already running local Ollama model.
set -euo pipefail
cd "$(dirname "$0")/../.."
model="$(printenv STAR_LOCAL_MODEL || printf 'qwen2.5-coder:7b')"
if [[ ! "$model" =~ ^[A-Za-z0-9._:/-]+$ ]]; then echo "Invalid STAR_LOCAL_MODEL" >&2; exit 2; fi
command -v curl >/dev/null || { echo "curl not found" >&2; exit 1; }
cli=".integrations/wormgptv2/node_modules/@gitlawb/wormgpt/dist/cli.mjs"
test -f "$cli" || { echo "First run: bash integrations/wormgptv2/bootstrap.sh" >&2; exit 1; }
curl --fail --silent --show-error --max-time 4 http://127.0.0.1:11434/api/tags >/dev/null ||
  { echo "Ollama must be running locally on port 11434." >&2; exit 1; }
export CLAUDE_CODE_USE_OPENAI=1
export OPENAI_BASE_URL=http://127.0.0.1:11434/v1
export OPENAI_MODEL="$model"
exec node "$cli" "$@"
