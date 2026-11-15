# STAR Vault — automatic conversation, research and memory archive

## Included

- Automatically records user messages, AI replies, research/mission plans, browsed GitHub file excerpts and STAR settings.
- Restores the last selected thread when a trusted browser reopens STAR CORE V2; lets the owner switch and delete threads.
- Indexes local data in IndexedDB. If browser storage is unavailable, a limited localStorage fallback is used. The browser can still clear site storage; offline persistence is not a formal backup.
- Imports the earlier manually saved Phase II chat archives **without deleting originals**.
- Adds voluntary owner memory notes, reused as concise context in future prompts. The UI shows what is remembered and lets the owner delete memories.
- Full archived threads can be reopened, but the model receives a bounded excerpt of the recent conversation, not literally all historical messages on every request.
- PRIVATE and AUTO chats stay device-local and are **not** uploaded to Supabase through STAR Vault. POWER chats, notes, research and settings can sync after server configuration.
- Remote access is gated by the existing server-verified STAR owner cookie, bearer owner token, or Cloudflare Access owner identity. No Supabase key or password is exposed to the client.

## Existing Supabase project

The dedicated table `public.star_ai_vault` was created in project **xwigjsrbalbjwwjkxyma** (region ap-northeast-1), with no changes to the preexisting financial/customs tables. Its rows are only accessible to the server-side privileged role. Both `anon` and `authenticated` are explicitly denied direct table grants; RLS is enabled and has no public policies.

Data model: `id TEXT PRIMARY KEY`, `kind` in thread/memory/settings/research, JSONB `payload`, timestamps and limits.

**Caveat:** This Supabase project also contains unrelated business data. A server-side Supabase secret grants broad project privileges, so using a dedicated new Supabase project later is preferable for stronger blast-radius isolation. The Cloudflare secret should never be exposed to frontend code.

## Cloudflare production configuration — required for cross-device sync

Configure on the **Cloudflare Pages project** `star-cyber-ai-x`, under Settings → Variables and Secrets (production environment):

```text
STAR_SUPABASE_URL=https://xwigjsrbalbjwwjkxyma.supabase.co
STAR_SUPABASE_SECRET_KEY=<Supabase project Secret API key (server-only)>
```

Recommended modern API secret format begins `sb_secret_`. Retrieve it in Supabase Dashboard → Project Settings / API Keys → Secret keys. Cloudflare must save this value as an encrypted secret, **never** as a public JavaScript variable, GitHub secret committed to files, client localStorage or chat message. Redeploy Cloudflare Pages to apply configuration.

Existing deployments continue to function without these values; cloud sync reports *not configured* and local-first auto-save remains active. When these secrets are configured, visit an authenticated STAR CORE V2 page to begin automatic synchronization.

The API endpoint `GET|PUT|DELETE /api/vault` is owner-only. Its content is plaintext in the database and is not end-to-end encrypted. Do not store credentials, private keys, sensitive operational secrets, or passwords in memory notes or research archives.

## Test plan

```sh
node scripts/test-star-vault.mjs
node --check web/star-vault.js
```

Then:
1. On an authenticated iPhone, create a thread, send a test message, close and reopen STAR CORE; verify it restores.
2. Create another thread; verify older threads remain selectable and past research shows in the archive.
3. Set a non-sensitive memory note, ask a related question, verify the note affects context appropriately.
4. Try PRIVATE mode; verify the chat remains local only.
5. After Cloudflare secrets are configured, use another authenticated device; verify POWER conversations synchronize automatically.
6. Verify unauthenticated `/api/vault` calls return 401 and cross-site writes return 403.

This release **cannot recover past unsaved sessions** that were never written anywhere. It imports only previous manually stored Phase II archives on the same browser where they exist.

Because the AI context window is finite, 'remember everything' means preserving the available records and retrieving relevant or recent context; it is not a claim that every record fits into every model inference. Inference still depends on the selected provider and its uptime.
