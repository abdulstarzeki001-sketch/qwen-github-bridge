# STAR BURP AI

Burp Suite extension built with the **Montoya API 2026.7**.

## Features

- Adds a **STAR AI** suite tab.
- Configure API URL, API token, Project ID, and Scope ID.
- Adds **Analyze with STAR AI** to request/response context menus.
- Adds **Inspect passively with STAR AI** for deterministic HTTP/JWT/session/header inspection without running an active test.
- When exactly two items are selected, adds **Compare 2 selected with STAR AI**.
- Sends only the request/response you explicitly select.
- Performs network calls off the Swing event thread.
- Displays backend JSON results inside Burp.
- Never logs the API token.

## Passive inspection

The passive inspector extracts and compares:

- request method, target, host, query keys and cookie names,
- Authorization scheme,
- JWT header and selected claims without verifying or cracking the signature,
- response status and content type,
- response security headers,
- cookie Secure / HttpOnly / SameSite attributes,
- response body-length differences,
- response body similarity,
- changed response headers.

Passive inspection does not create or send modified requests.

## Build

Requires Java 17+ and Maven.

```bash
mvn -B clean package
```

Output:

```text
target/star-burp-ai-0.2.0.jar
```

## Load into Burp

1. Open **Extensions**.
2. Add a Java extension.
3. Select the generated JAR.
4. Open the **STAR AI** tab.
5. Set the API URL and API token.
6. Set the Project ID and an authorized Scope ID for full AI analysis.
7. Right-click a request/response and choose the STAR action you need.

The extension does not automatically export Proxy history. You choose each item sent to STAR CYBER AI X.
