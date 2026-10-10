# STAR Free CPU Brain

This is the **zero-secret fallback brain** for STAR CYBER AI X.

It runs entirely inside a GitHub Actions Ubuntu runner using:

- Ollama
- `qwen2.5-coder:1.5b-instruct`
- CPU inference
- repository files checked out by GitHub Actions

No Cloudflare account, API key, GPU, or external AI credential is required.

## What it does

When the workflow is introduced or its implementation changes on `main`, it automatically:

1. starts Ollama in a local Docker container,
2. downloads the 1.5B Qwen coding model,
3. performs a connectivity smoke test,
4. selects a small set of security-sensitive source files,
5. runs a defensive secure-code review,
6. publishes the Markdown report in the workflow summary,
7. uploads the report as a GitHub Actions artifact.

## Limitations

This is intentionally a small CPU model. It is useful as a free fallback, CI reviewer, and connectivity proof, but it is substantially less capable than a large GPU-hosted model.

The always-on STAR web/Burp runtime still benefits from Cloudflare Workers AI or a private GPU provider.

GitHub Actions usage also counts against whatever Actions quota applies to the repository/account.
