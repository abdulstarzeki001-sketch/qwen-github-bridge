# Burp Suite integration

STAR BURP AI is a Java 17 Montoya API extension.

## Build

```bash
gradle -p burp-extension jar
```

The CI workflow compiles it on every pull request.

## Configure

Open the `STAR AI` tab in Burp and set:

- API URL
- STAR API token
- Project ID
- authorized Scope ID

Then right-click a request/response and select:

```text
Analyze with STAR AI
```

The extension forwards the selected HTTP request and response to:

```text
POST /api/burp/analyze
```

The backend stores the evidence bundle, asks the analyst model, asks an independent verifier, records the finding, and returns the result.

## Evidence attachments

Screenshots and other evidence can be attached through:

```text
POST /api/evidence/{project_id}/{bundle_id}/attachments
```

Maximum attachment size is 20 MB per upload.
