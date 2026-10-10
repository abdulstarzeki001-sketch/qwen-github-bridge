# GitHub-native free AI brain

STAR CYBER AI X includes a GitHub-native AI path that does not require a Cloudflare token.

GitHub Actions can call GitHub Models using the built-in short-lived `GITHUB_TOKEN` with:

```yaml
permissions:
  contents: read
  models: read
```

No long-lived AI credential is stored.

## Workflows

### GitHub Models Smoke Test

Runs automatically when its workflow/script is first merged to `main`, and can also be run manually.

Expected success:

```text
GitHub Models connection: OK
Model: openai/gpt-4.1
Response: STAR GITHUB BRAIN ONLINE
```

### STAR GitHub Brain

A manual repository security/code-review workflow.

Open:

```text
Actions → STAR GitHub Brain → Run workflow
```

You may provide a custom task or use the default defensive review.

The report is:

- shown in the GitHub Actions job summary,
- uploaded as `star-github-brain-report` artifact.

## Scope

This GitHub-native brain is ideal for repository analysis and CI automation.

The always-on STAR web API and Burp integration still need an external inference API when used outside GitHub Actions. Cloudflare Workers AI remains the default free option for that always-on runtime.
