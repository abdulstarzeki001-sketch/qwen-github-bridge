# STAR AI ↔ Supabase: Secure Owner Sync (2026-10-22)

## What is configured

| Item | Value |
| --- | --- |
| Project | `xwigjsrbalbjwwjkxyma` (pre-existing, shared with other applications) |
| API URL | `https://xwigjsrbalbjwwjkxyma.supabase.co` |
| Frontend credential | Enabled Supabase **publishable** `sb_publishable_…` (safe for public web clients) |
| STAR data table | `public.star_ai_user_vault` |
| Authentication | Email OTP / Magic Link or existing Supabase email+password **plus** STAR Owner sign-in |
| Database security | RLS on; `anon` access revoked; four owner-scoped policies using `user_id = (select auth.uid())` |
| Cross-device sync | Works after the **same Supabase account** is signed in on each trusted STAR owner device |
| Site | `https://star-cyber-ai-x.pages.dev/ai-v2.html` |

The legacy `public.star_ai_vault` is kept intact and retains service-role-only grants for backward compatibility. It contained **zero records** when this change was prepared. Other project tables (including companies and customs documents) were not modified.

## How the owner enables synchronization

1. Sign in as **STAR Owner** at `/ai-v2.html` on your trusted iPhone/computer. Supabase's widget stays hidden until STAR authentication succeeds.
2. Open **Supabase · مزامنة آمنة بين أجهزتك**.
3. Enter an email account accepted by Supabase Auth and request **إرسال رابط أو رمز**.
4. Depending on the Supabase **Email Auth template**, the email contains either a Magic Link or a 6–8 digit OTP. Open the link on the **same STAR origin**, or enter the code and tap **تأكيد الرمز**. Existing account holders can alternatively sign in with their Supabase email/password via the collapsed password panel.
5. For Magic Links, add `https://star-cyber-ai-x.pages.dev/ai-v2.html` to **Supabase Dashboard → Authentication → URL Configuration → Redirect URLs** if it is not already present. This dashboard setting cannot be edited through the installed Supabase connector.
6. Check **تذكّر الاتصال** only on a device you control (the Supabase refresh token will then be stored in localStorage). Otherwise it stays in sessionStorage and is cleared when the browsing session ends.
7. After verified Supabase Auth, STAR automatically reconciles the local IndexedDB Vault with `public.star_ai_user_vault`. The **مزامنة الآن** button can force another reconciliation.
8. Sign in with the **same** Supabase account on your other STAR-owner-verified device. Documents, notes and chat threads can sync between those browsers.

Supabase and STAR login are separate gates. No service-role / `sb_secret` key is embedded in browser JavaScript, in the repository or in client preferences.

## Technical details

- The browser calls only `https://xwigjsrbalbjwwjkxyma.supabase.co/auth/v1/` for authentication and `.../rest/v1/star_ai_user_vault` for the database. The Cloudflare Content-Security-Policy permits that exact Supabase origin.
- The PostgREST API gets the **publishable** key in `apikey` and the Supabase user JWT in `Authorization: Bearer …`. The server derives the row owner via `auth.uid()`; the client never supplies `user_id` when inserting.
- Each signed-in user sees only their own records under RLS. Upsert conflict target `user_id,id` isolates record IDs across accounts.
- STAR's previous secure `/api/vault` server flow remains available as a fallback when this direct RLS connection is not signed in.
- A first-time successful connection binds that browser's local STAR archive to the Supabase user ID. This intentionally blocks signing into another Supabase user and silently leaking local files into a different account.
- The rest of STAR continues to use its existing Cloudflare AI provider; this integration creates no additional GPU/LLM API charges.

## Security and limitations

- Supabase **publishable** keys are not secrets. Service-role keys are secrets, **never** store them in `web/`, GitHub, a public Pages environment variable or iPhone localStorage.
- RLS isolation is database-enforced; client-side visibility is only an extra UX guard.
- Browser storage is not encrypted at rest by this feature. Files stored on a compromised/unlocked device may be exposed. Secure the device.
- The Supabase project is shared with other apps: do not change unrelated Auth provider settings or RLS policies without checking impact.
- Anonymous users cannot read the new vault table. Existing project security advisories (an older table with RLS but no policies, a separate security-definer function and disabled leaked-password protection) are outside the scope and should be reviewed for their original applications.
- The installed connector cannot change Supabase Auth URL allowlist/email templates and there is no direct Cloudflare secret-management connector. This approach does **not** depend on missing Cloudflare server secrets.
- If Supabase's default email template sends a Magic Link but the project's redirect allowlist does not include the STAR URL, the redirect requires the dashboard adjustment above. If the email uses OTP codes, the in-page verification flow works without a redirect.
- Supabase Auth email delivery depends on the project's email provider and SMTP/rate limits; successful email delivery and an authenticated first full sync still require a real account-based end-to-end test.
- **A document deleted while offline may still exist on another device until synchronization**; existing Vault deletion logic predates this feature and tombstone-based deletion propagation remains future work.

## Tests

```sh
node scripts/test-star-supabase-sync.mjs
node scripts/test-star-vault.mjs
node scripts/test-star-knowledge.mjs
node --check web/star-supabase-sync.js
```

Database security verified with:

```sql
select relrowsecurity from pg_class where oid='public.star_ai_user_vault'::regclass;
select has_table_privilege('anon','public.star_ai_user_vault','SELECT');
select has_table_privilege('authenticated','public.star_ai_user_vault','SELECT');
select * from pg_policies where tablename='star_ai_user_vault';
```

Expected: `true`, `false`, `true`, and four explicit owner-only RLS policies.
