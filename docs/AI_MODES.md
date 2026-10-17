# STAR AI modes

STAR AI exposes three explicit routing modes in `web/ai.html`.

## PRIVATE

The browser talks directly to an InferrLM server on a loopback or private-LAN address.

Expected InferrLM endpoints:

- `GET /api/tags` — discover available models
- `POST /api/chat` — non-streaming chat

No provider API key is stored in the STAR web page.

Default same-device address:

```text
http://127.0.0.1:8889
```

The UI also accepts RFC1918 private-LAN hosts for an InferrLM server on another owned device.

## POWER

The browser calls STAR's existing `POST /api/chat` backend. Provider selection remains server-side and credentials stay in server environment/secrets.

## AUTO

AUTO is deliberately local-first. It tries PRIVATE and, if local inference is unavailable, stops and asks the owner to switch to POWER manually. It never silently uploads the prompt to the cloud.

## iPhone notes

1. Start InferrLM's Server tab.
2. Import/load the desired local model.
3. In STAR AI, choose PRIVATE.
4. Keep `http://127.0.0.1:8889` for same-device access or use the private LAN URL shown by InferrLM.
5. Tap **فحص InferrLM** to populate the model selector.

A browser may enforce mixed-content or local-network restrictions depending on iOS/WebKit and how STAR is opened. The UI surfaces connection errors rather than falling back to cloud.
