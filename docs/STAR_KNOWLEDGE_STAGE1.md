# STAR Knowledge — Stage 1: private documents and source-grounded answers

Available on **https://star-cyber-ai-x.pages.dev/ai-v2.html**, only after a valid owner login.

## Features implemented
- Keep the configured STAR cloud model: the current `/api/health` reported `nvidia/nemotron-3-ultra-550b-a55b:free` (OpenRouter). Owner model overrides still require the server-side `STAR_ALLOWED_MODELS` allowlist. We do not silently switch vendors, spend money, or hardcode API keys.
- Save original text from `.txt`, `.md`, `.json`, selected source code and logs, plus **text-based PDF** files. Extraction of PDF text happens in the iPhone/desktop browser using PDF.js 4.10.38 loaded from a pinned CDN. The PDF file is not submitted to a PDF-processing service; however the third-party PDF.js JavaScript asset is downloaded over HTTPS to the browser, so first-time PDF import requires that CDN to be reachable and trusted.
- File input maximum **2MiB** and extracted text maximum **180,000 characters** per document; PDF maximum **120 pages**. Documents are split into <=60,000-character parts and saved as owner-only `research` records with `source_type: "knowledge"` in STAR Vault.
- List, preview and **delete** imported documents. Sources are named after the uploaded file; no invented citations.
- On each normal STAR chat, when the opt-in *استخدم المقاطع ذات الصلة* is checked, a deterministic search scores relevant chunks locally. Only the retrieved excerpts, up to a bounded context size, and the user's question are sent to the **existing cloud AI provider**. Excerpts carry citation tags `[K1]`, `[K2]`, etc. The UI also shows the exact excerpts sent to the model. Unrelated documents are not sent.
- This is **keyword-based retrieval (lexical RAG)**; there are **no stored embeddings and no vector similarity yet**. The model can still make errors; the citations are a trace to which owner-supplied source excerpts were presented, not third-party validation of those sources.
- Existing STAR Vault threads, memories, and owner access are preserved. Unrelated business tables in Supabase were not touched.

## Security and durability
- Inference, source list and imports remain **owner-only**. Files are parsed locally, and no raw file is automatically sent to the AI provider; selected excerpts are transmitted only while source inclusion is enabled.
- Imported documents are kept in browser IndexedDB like other STAR Vault data. If `STAR_SUPABASE_URL` and `STAR_SUPABASE_SECRET_KEY` are configured in the **Cloudflare Pages production server secrets** and an owner session is present, existing `/api/vault` saves document records to the private `public.star_ai_vault` table. That table is already present with RLS enabled, no grants to `anon` or `authenticated`, and `service_role` only. No database schema change is necessary.
- **Production secret setup was not accessible for this change:** absent secrets mean local-only saving. Cross-device sync is not confirmed until those secrets are configured and end-to-end tested. Do not put secret keys in code, GitHub files or browser localStorage.
- Deleting a document from STAR deletes currently available local parts, and when cloud sync is active also issues deletes to Supabase. If the browser is offline or cloud sync is not active but prior cloud copies exist, do not assume permanent deletion on another device; confirm again when the cloud connection is restored. This is a limitation to resolve with proper tombstones in a future synchronization phase.
- Existing conversation records may still contain quoted excerpts from imported files. Deleting a document does not automatically scrub historical conversation text.
- Documents are untrusted data, not instructions for the AI. Never upload secrets, private credentials or material you cannot send to the AI provider; if source inclusion is enabled, matching excerpts are sent on a question.

## Unsupported in Stage 1
- OCR for scanned PDF files or photos
- Semantic pgvector embeddings; embeddings would require a model and a backfill pipeline
- Guaranteed free/uninterrupted service from any external model provider
- Cloudflare secrets setup on behalf of owner (not accessible from the GitHub connector)

## Validate
```sh
node scripts/test-star-knowledge.mjs
node scripts/test-star-vault.mjs
node --check web/star-knowledge-core.js
node --check web/star-knowledge.js
```

Browser test: log in as owner, import harmless `TXT`, ask a question containing multiple distinctive terms from its content, verify the source excerpt is shown as `[K1]`, delete document and verify the citation no longer appears. Repeat with text PDF when CDN access is available, and verify an unauthenticated visitor cannot import.
