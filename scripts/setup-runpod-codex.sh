#!/usr/bin/env bash
# Official Runpod Codex onboarding: https://agents.runpod.io/
set -euo pipefail
fail(){ printf 'ERROR: %s\n' "$*" >&2; exit 1; }

command -v node >/dev/null 2>&1 || fail "Node.js >=22.20 is required."
command -v npx >/dev/null 2>&1 || fail "npx is required."
version="$(node -p 'process.versions.node')"
major="${version%%.*}"
tmp="${version#*.}"
minor="${tmp%%.*}"
if ((major < 22 || (major == 22 && minor < 20))); then
  fail "Node.js $version is below the required 22.20. Upgrade to Node 24 or newer and retry."
fi
command -v codex >/dev/null 2>&1 || fail "Codex CLI is not installed. Install Codex CLI on your Mac or computer and retry."

echo "Installing official Runpod Skills for Codex..."
npx -y skills add runpod/runpod-plugins-official --skill '*' --agent codex --yes --global
echo "Checking global Runpod Skills..."
npx -y skills list --global
echo "Registering official hosted Runpod MCP..."
if codex plugin marketplace add https://github.com/runpod/runpod-plugins-official.git &&
   codex plugin add runpod@runpod; then
  echo "Runpod plugin registered."
else
  echo "Codex plugin registration was unavailable; trying its official MCP endpoint..."
  codex mcp add runpod --url https://mcp.runpod.io/
fi
cat <<'TXT'
Completed machine-side install commands. OAuth has NOT been completed.
Owner actions: restart Codex, sign in to Runpod when prompted,
then ask "List my Runpod Pods" and verify the correct account.
This script rents NO GPU, creates NO API key, and leaves STAR's cloud provider unchanged.
TXT
