# Burp Suite integration

STAR BURP AI is a Java 17 Montoya API extension.

## Build

```bash
mvn -B -f burp-extension/pom.xml clean package
```

The CI workflow compiles it on every pull request and uploads the JAR as an artifact.

## Configure

Open the `STAR AI` tab in Burp and set:

- API URL
- STAR API token
- Project ID
- authorized Scope ID

## Context-menu actions

### Analyze with STAR AI

Sends the selected request/response to:

```text
POST /api/burp/analyze
```

This path is scope-gated. The backend stores an evidence bundle, runs the analyst model, runs an independent verifier, saves the finding, and returns the result.

### Inspect passively with STAR AI

Sends the selected exchange to:

```text
POST /api/burp/inspect
```

This path performs deterministic passive inspection only. It does not send a modified HTTP request to the target.

It inspects:

- HTTP request/response metadata,
- Authorization scheme,
- JWT header and selected claims,
- cookie attributes,
- common browser-security response headers,
- basic passive observations.

### Compare 2 selected with STAR AI

Select exactly two Burp history items and use:

```text
POST /api/burp/compare
```

The backend returns:

- status-code changes,
- body-length delta,
- response-body similarity,
- changed response headers,
- passive inspection for both exchanges.

This is useful for evidence comparison in authorized testing without automatically generating or sending attack traffic.

## Evidence attachments

Screenshots and other evidence can be attached through:

```text
POST /api/evidence/{project_id}/{bundle_id}/attachments
```

Maximum attachment size is 20 MB per upload.
