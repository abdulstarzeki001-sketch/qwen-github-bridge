# Owner-only browser chat (Cloudflare Access)

Cloudflare Access must be configured by the owner in the Cloudflare Zero Trust dashboard; GitHub commits cannot provision Access automatically.

1. Create a Cloudflare Access **self-hosted application** protecting `star-cyber-ai-x.pages.dev` (ideally the entire hostname, including `/ai.html` and `/api/chat`).
2. Create an **Allow** policy for only the owner's email address. Configure an identity provider / one-time PIN and test the login. Do not use a Bypass policy.
3. In Cloudflare Pages > Settings > Variables and Secrets, set:
   - `STAR_ACCESS_TEAM_DOMAIN` to `https://YOUR-TEAM.cloudflareaccess.com` (the JWT issuer)
   - `STAR_ACCESS_AUD` to the Access application AUD tag
   - `STAR_OWNER_EMAIL` to the allowed owner email
   - `STAR_AI_PROVIDER` to `cloudflare`
4. Deploy the Pages project with the Workers AI `AI` binding defined in `wrangler.toml`.
5. Visit `/ai.html`, authenticate through Access, then send a message. The browser never needs `STAR_API_TOKEN`.

The API independently verifies the Access JWT signature, issuer, audience, expiry, and owner email. Existing `STAR_API_TOKEN` bearer auth remains for explicitly authenticated API clients. Do not put this token in HTML or localStorage. If Access variables are missing, browser chat fails closed with 401.

Cloudflare Workers AI is the cloud inference service, not the user's iPhone GGUF model. Free usage is quota-limited. PocketPal local API connectivity is not guaranteed. Automatic fallback is not implemented.

**Important:** Deploying the GitHub code alone does not enable Access or the AI binding. Cloudflare dashboard configuration and end-to-end testing are still required.
