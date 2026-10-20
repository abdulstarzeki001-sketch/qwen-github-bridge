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


## LLM data minimization

Raw Burp evidence remains in the local evidence bundle, but STAR now sanitizes data before sending it to an LLM:

- Authorization and proxy-authorization headers
- Cookie and Set-Cookie headers
- API-key and access-token headers
- common password/token/secret fields in JSON and text
- common bearer/JWT/provider-token patterns

Redactions use deterministic short SHA-256 markers so repeated values can still be compared without exposing the original credential.

Repository review also masks common embedded credential patterns before model submission.

## Target validation

Scanner targets are validated before execution. STAR rejects control characters, embedded URL credentials, missing hostnames, and non-HTTP schemes for web scanners.
