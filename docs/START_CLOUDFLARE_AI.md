# Start STAR with Cloudflare Workers AI

This is the shortest path to turn on the AI brain.

## 1. Create a Workers AI API token

In Cloudflare Dashboard, create a scoped API token that can call Workers AI for your account.

Do not paste the token into source code, issues, commits, or chat messages.

## 2. Add GitHub repository secrets

Open this repository on GitHub and go to:

```text
Settings
→ Secrets and variables
→ Actions
→ New repository secret
```

Create these two secrets:

```text
CLOUDFLARE_ACCOUNT_ID
CLOUDFLARE_API_TOKEN
```

Optional repository variable:

```text
CLOUDFLARE_AI_MODEL=@cf/meta/llama-3.1-8b-instruct
```

If you do not create the variable, the workflow uses Llama 3.1 8B automatically.

## 3. Run the connection test

Open:

```text
Actions
→ Cloudflare AI Smoke Test
→ Run workflow
```

Success looks like:

```text
Cloudflare Workers AI connection: OK
Model: @cf/meta/llama-3.1-8b-instruct
Response: STAR AI ONLINE
```

## 4. Runtime configuration

Wherever STAR CYBER AI X itself is deployed, configure the same Cloudflare values:

```env
AI_PROVIDER=cloudflare
CLOUDFLARE_ACCOUNT_ID=...
CLOUDFLARE_API_TOKEN=...
CLOUDFLARE_AI_MODEL=@cf/meta/llama-3.1-8b-instruct
```

Do not expose these values in the browser frontend.

## Notes

- The smoke test sends one very small prompt to minimize free-tier usage.
- It never prints the API token.
- GitHub repository secrets are not readable back through the application.
