# Security policy

This repository contains a security-testing platform.

## Reporting a vulnerability in STAR CYBER AI X

Use GitHub's private security advisory feature for this repository when available. Do not publish credentials, API tokens, private evidence, or customer traffic in a public issue.

## Secrets

Never commit:

- STAR_API_TOKEN
- LLM_API_KEY
- deployment webhook credentials
- Burp session traffic containing real secrets
- production evidence bundles

Use repository or deployment secrets instead.
