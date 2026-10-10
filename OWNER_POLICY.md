# STAR AI ∞ — Owner policy

Set a **Cloudflare Pages environment variable** named `STAR_OWNER_POLICY_JSON`. Keep it server-side, never in the frontend.

Example:

```json
{
  "identity": "STAR AI ∞",
  "instructions": "Respond in Arabic by default. Prioritize coding and explain changes precisely.",
  "allowGithubRead": true,
  "requireReviewForWrites": true,
  "maxPromptChars": 6000
}
```

Redeploy the Cloudflare Pages project after changing runtime environment settings if needed.

- These settings control assistant instructions and the read-only GitHub feature.
- The owner policy does **not** remove provider safety rules, Cloudflare limits, or GitHub permissions.
- GitHub write and deployment permissions are **not** granted by JSON; implementing them requires owner authentication, scoped GitHub App permissions, audit logging and a review flow.
- Never put API keys, admin tokens, or private keys in this JSON.
- The current chat API still requires `STAR_API_TOKEN`; the standalone `/ai.html` frontend intentionally does not store credentials. A secure owner session or rate-limited public free-chat mode must be implemented separately.
