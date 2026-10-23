#!/usr/bin/env bash
# Shared RunPod Pod model-list validation (no network, no model pull).
# Source before starting Ollama; STAR_MODEL_LIST is a Bash array.
validate_star_model_config() {
  STAR_MODEL="${STAR_MODEL:-gpt-oss:20b}"
  STAR_ALLOWED_MODELS="${STAR_ALLOWED_MODELS:-$STAR_MODEL}"
  if [[ ! "$STAR_MODEL" =~ ^[A-Za-z0-9._:/-]{3,120}$ ]]; then
    echo "Invalid STAR_MODEL identifier" >&2
    return 2
  fi
  if [[ "$STAR_ALLOWED_MODELS" == ,* || "$STAR_ALLOWED_MODELS" == *, ||
        "$STAR_ALLOWED_MODELS" == *,,* ]]; then
    echo "Invalid STAR_ALLOWED_MODELS separator" >&2
    return 2
  fi
  local -a choices=()
  local -a normalized=()
  local name prior duplicate has_default=0
  local -i count=0
  IFS=',' read -r -a choices <<< "$STAR_ALLOWED_MODELS"
  if (( ${#choices[@]} < 1 || ${#choices[@]} > 12 )); then
    echo "STAR_ALLOWED_MODELS must contain 1-12 models" >&2
    return 2
  fi
  for name in "${choices[@]}"; do
    # Whitespace around comma-separated model names is tolerated, not embedded whitespace.
    name="${name#"${name%%[![:space:]]*}"}"
    name="${name%"${name##*[![:space:]]}"}"
    if [[ ! "$name" =~ ^[A-Za-z0-9._:/-]{3,120}$ ]]; then
      echo "Invalid model identifier in STAR_ALLOWED_MODELS" >&2
      return 2
    fi
    for prior in "${normalized[@]}"; do
      if [[ "$name" == "$prior" ]]; then
        echo "Duplicate model identifier in STAR_ALLOWED_MODELS" >&2
        return 2
      fi
    done
    normalized+=("$name")
    if [[ "$name" == "$STAR_MODEL" ]]; then has_default=1; fi
    ((count+=1))
  done
  if (( has_default != 1 )); then
    echo "STAR_ALLOWED_MODELS must include STAR_MODEL" >&2
    return 2
  fi
  STAR_MODEL_LIST=("${normalized[@]}")
  STAR_ALLOWED_MODELS="$(IFS=,; echo "${STAR_MODEL_LIST[*]}")"
  export STAR_MODEL STAR_ALLOWED_MODELS
}
if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
  set -euo pipefail
  validate_star_model_config
  printf '%s\n' "${STAR_MODEL_LIST[@]}"
fi
