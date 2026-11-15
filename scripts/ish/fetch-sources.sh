#!/bin/sh
# Source-only fetcher for iSH Alpine, Linux, and GitHub Actions.
# Never execute code from upstream repositories. Uses exact pinned Git SHAs.
set -eu
ROOT=$(CDPATH= cd "$(dirname "$0")/../.." && pwd)
REGISTRY="$ROOT/scripts/ish/sources.psv"
DEST="$ROOT/integrations/upstreams"
MODE="${1:-core}"
SELECTED="${2:-}"

usage() {
  echo "Usage: sh scripts/ish/fetch-sources.sh {core|all|list|status|one ID}" >&2
  exit 2
}
case "$MODE" in
  core|all|list|status) [ -z "$SELECTED" ] || usage ;;
  one) [ -n "$SELECTED" ] || usage ;;
  *) usage ;;
esac
[ -f "$REGISTRY" ] || { echo "Missing upstream sources.psv" >&2; exit 1; }
if [ "$MODE" = "list" ]; then
  printf '%-22s %-34s %s\n' "NAME" "REPOSITORY" "GROUP"
  while IFS='|' read -r id remote sha group description || [ -n "$id" ]; do
    case "$id" in ''|'#'*) continue;; esac
    printf '%-22s %-34s %s\n' "$id" "$remote" "$group"
  done < "$REGISTRY"
  exit 0
fi
if [ "$MODE" != "status" ]; then
  command -v git >/dev/null 2>&1 || { echo "Install git: apk add git" >&2; exit 1; }
fi
mkdir -p "$DEST"
matched=0
failed=0
while IFS='|' read -r id remote sha group description || [ -n "$id" ]; do
  case "$id" in ''|'#'*) continue;; esac
  case "$id" in *[!a-z0-9_-]*) echo "Invalid source ID" >&2; exit 1;; esac
  case "$remote" in
    */*) case "$remote" in *[!A-Za-z0-9._/-]*|*../*|*/../*|/*) echo "Unsafe repository name" >&2; exit 1;; esac ;;
    *) echo "Invalid repository" >&2; exit 1 ;;
  esac
  case "$sha" in *[!0-9a-f]*|'') echo "Invalid commit checksum" >&2; exit 1;; esac
  [ "${#sha}" -eq 40 ] || { echo "Expected a 40-character commit SHA" >&2; exit 1; }
  if [ "$MODE" = "core" ] && [ "$group" != "core" ]; then continue; fi
  if [ "$MODE" = "one" ] && [ "$id" != "$SELECTED" ]; then continue; fi
  matched=$((matched+1))
  dir="$DEST/$id"
  if [ "$MODE" = "status" ]; then
    if [ -d "$dir/.git" ]; then
      current=$(git -C "$dir" rev-parse HEAD 2>/dev/null || printf 'incomplete')
      if [ "$current" = "$sha" ]; then
        printf '[OK] %s %s\n' "$id" "$current"
      else
        printf '[CHANGED] %s (%s)\n' "$id" "$current"
      fi
    else
      printf '[MISSING] %s\n' "$id"
    fi
    continue
  fi
  echo "Fetching source [$matched] $id from $remote (read-only, no execution)..."
  if [ ! -d "$dir/.git" ]; then
    if [ -e "$dir" ] && [ -n "$(ls -A "$dir")" ]; then
      echo "Refusing to overwrite existing non-Git folder: $dir" >&2
      failed=$((failed+1))
      continue
    fi
    mkdir -p "$dir"
    git -C "$dir" init -q
    git -C "$dir" remote add origin "https://github.com/$remote.git"
  else
    original=$(git -C "$dir" remote get-url origin 2>/dev/null || true)
    if [ "$original" != "https://github.com/$remote.git" ]; then
      echo "Refusing to replace unexpected Git remote for $id" >&2
      failed=$((failed+1))
      continue
    fi
    if [ -n "$(git -C "$dir" status --porcelain 2>/dev/null)" ]; then
      echo "Local edits in $id: skipping to protect them" >&2
      failed=$((failed+1))
      continue
    fi
  fi
  if ! GIT_TERMINAL_PROMPT=0 GIT_LFS_SKIP_SMUDGE=1 git -C "$dir" -c core.hooksPath=/dev/null fetch --quiet --no-tags --depth=1 origin "$sha"; then
    echo "Fetch failed for $id; other sources remain unchanged" >&2
    failed=$((failed+1))
    continue
  fi
  if ! GIT_LFS_SKIP_SMUDGE=1 git -C "$dir" -c core.hooksPath=/dev/null checkout --quiet --detach "$sha"; then
    echo "Checkout failed for $id" >&2
    failed=$((failed+1))
    continue
  fi
  actual=$(git -C "$dir" rev-parse HEAD)
  if [ "$actual" != "$sha" ]; then
    echo "Commit mismatch for $id" >&2
    failed=$((failed+1))
    continue
  fi
  printf '[READY] %s at %s\n' "$id" "$actual"
done < "$REGISTRY"
if [ "$matched" -eq 0 ]; then echo "Unknown source name: $SELECTED" >&2; exit 2; fi
echo "Sources selected: $matched; errors: $failed; location: $DEST"
[ "$failed" -eq 0 ]
