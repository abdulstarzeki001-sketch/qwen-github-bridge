FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \\
    DATABASE_PATH=/data/starcyber.db \\
    EVIDENCE_DIR=/data/evidence

RUN apt-get update && apt-get install -y --no-install-recommends \
    nmap curl ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && adduser --system --group --home /app starcyber

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app
COPY web ./web

RUN mkdir -p /data/evidence \
    && chown -R starcyber:starcyber /data /app

USER starcyber
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8080/api/health', timeout=3)" || exit 1

CMD ["uvicorn","app.main:app","--host","0.0.0.0","--port","8080"]
