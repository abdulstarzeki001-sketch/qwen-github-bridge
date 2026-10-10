# Security Model

## Permission model

1. READ
2. ANALYZE
3. TEST
4. MODIFY
5. DEPLOY

The starter requires `scopes.authorized = true` before active test endpoints are allowed.

## Evidence integrity

Each Burp evidence bundle stores SHA-256 hashes for captured request and response data.

## Scanner boundary

The starter runner is configured for:

- Nmap service/version discovery without exploit NSE categories
- Nuclei with rate limiting and no Interactsh
- ZAP baseline checks

Destructive payload automation, persistence, credential theft, ransomware, and uncontrolled exploitation are not part of this starter.
