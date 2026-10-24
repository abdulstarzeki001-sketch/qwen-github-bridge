#!/bin/sh
# STAR NEXUS workstation for iSH (Alpine x86), Linux, and Mac (read-only preview).
set -eu
ROOT=$(CDPATH= cd "$(dirname "$0")/../.." && pwd)
COMMAND="${1:-help}"
case "$COMMAND" in
  setup)
    echo "[STAR] Installing lightweight iSH tools..."
    if command -v apk >/dev/null 2>&1; then
      apk update
      apk add --no-cache git python3 curl ca-certificates openssh-client
      update-ca-certificates 2>/dev/null || true
    else
      echo "Not Alpine Linux: install git, Python 3, curl, and SSH using your system package manager."
    fi
    echo "[STAR] Prerequisites installed. No GPU/AI model started locally."
    ;;
  sync)
    cd "$ROOT"
    if [ -n "$(git status --porcelain)" ]; then
      echo "[STAR] Local worktree has changes; refusing to overwrite. Commit or stash first." >&2
      exit 1
    fi
    branch=$(git branch --show-current)
    if [ "$branch" != "main" ]; then
      echo "[STAR] Switch to main before sync. Current: $branch" >&2
      exit 1
    fi
    git fetch origin main
    git merge --ff-only origin/main
    echo "[STAR] Updated main without overwriting local commits."
    ;;
  sources)
    shift
    sh "$ROOT/scripts/ish/fetch-sources.sh" "${1:-core}" "${2:-}"
    ;;
  telegram)
    shift
    command -v python3 >/dev/null 2>&1 || { echo "Python 3 required: apk add python3" >&2; exit 1; }
    exec python3 "$ROOT/scripts/ish/telegram.py" "${1:-help}"
    ;;
  doctor)
    echo "===== STAR iSH diagnostics ====="
    echo "Repository: $ROOT"
    for tool in git python3 curl ssh; do
      if command -v "$tool" >/dev/null 2>&1; then echo "[OK] $tool"; else echo "[MISSING] $tool"; fi
    done
    for file in web/index.html web/nexus.js web/nexus.css scripts/ish/sources.psv; do
      if [ -s "$ROOT/$file" ]; then echo "[OK] $file"; else echo "[MISSING] $file"; fi
    done
    echo "Git commit: $(git -C "$ROOT" rev-parse --short HEAD 2>/dev/null || printf 'not available')"
    echo "Local source inventory:"
    sh "$ROOT/scripts/ish/fetch-sources.sh" status
    echo "Published STAR API (does not test private owner login):"
    if command -v curl >/dev/null 2>&1; then
      if curl --fail --silent --show-error --connect-timeout 7 --max-time 12 https://star-cyber-ai-x.pages.dev/api/health > /dev/null; then
        echo "[OK] Cloudflare STAR health endpoint responded"
      else
        echo "[NOT READY] Check iPad Internet/DNS and Cloudflare deployment"
      fi
    fi
    echo "iSH cannot directly execute Cloudflare Pages Functions, Docker, or a GPU LLM."
    ;;
  serve)
    command -v python3 >/dev/null 2>&1 || { echo "Install Python 3 first: sh scripts/ish/star.sh setup" >&2; exit 1; }
    port="${2:-8080}"
    case "$port" in ''|*[!0-9]*) echo "Invalid port" >&2; exit 2 ;; esac
    if [ "$port" -lt 1024 ] || [ "$port" -gt 65535 ]; then
      echo "Use a port between 1024 and 65535" >&2; exit 2
    fi
    echo "STAR local STATIC preview on http://127.0.0.1:$port/ (open in iPad Safari)"
    echo "Backend API is only functional on https://star-cyber-ai-x.pages.dev/"
    echo "Press Ctrl+C inside iSH to stop."
    exec python3 -m http.server "$port" --bind 127.0.0.1 --directory "$ROOT/web"
    ;;
  help|--help|-h)
    cat <<'HELP'
STAR NEXUS iSH commands (run inside the cloned STAR repository):
  sh scripts/ish/star.sh setup
  sh scripts/ish/star.sh sync
  sh scripts/ish/star.sh sources list
  sh scripts/ish/star.sh sources core
  sh scripts/ish/star.sh sources all
  sh scripts/ish/star.sh sources one drana
  sh scripts/ish/star.sh telegram help
  sh scripts/ish/star.sh telegram chat-id
  sh scripts/ish/star.sh telegram check-star
  sh scripts/ish/star.sh telegram set-webhook
  sh scripts/ish/star.sh telegram status
  sh scripts/ish/star.sh doctor
  sh scripts/ish/star.sh serve 8080
Everything under integrations/upstreams/ is third-party source, not auto-installed/executed.
Live model/chat: https://star-cyber-ai-x.pages.dev/
HELP
    ;;
  *)
    echo "Unknown command: $COMMAND" >&2
    exit 2
    ;;
esac
