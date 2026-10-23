# One-container build for RunPod GPU Pods; no Docker daemon inside the Pod required.
# Base Ollama Docker image currently uses Ubuntu 24.04 (glibc compatible with Node bookworm).
FROM node:24-bookworm-slim AS node-runtime
FROM ollama/ollama:latest

COPY --from=node-runtime /usr/local/bin/node /usr/local/bin/node
COPY gateway.mjs /opt/star/gateway.mjs
COPY runpod/start-runpod.sh /opt/star/start-runpod.sh
COPY runpod/model-config.sh /opt/star/model-config.sh
RUN chmod 755 /opt/star/start-runpod.sh /opt/star/model-config.sh && mkdir -p /workspace/ollama

ENV OLLAMA_HOST=127.0.0.1:11434 \
    OLLAMA_MODELS=/workspace/ollama \
    STAR_MODEL=gpt-oss:20b \
    OLLAMA_NUM_PARALLEL=1 \
    OLLAMA_MAX_LOADED_MODELS=1 \
    OLLAMA_KEEP_ALIVE=10m \
    PORT=8080 \
    OLLAMA_ENDPOINT=http://127.0.0.1:11434/v1/chat/completions
EXPOSE 8080
ENTRYPOINT ["/bin/bash", "/opt/star/start-runpod.sh"]
