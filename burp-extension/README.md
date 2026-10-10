# STAR BURP AI

Burp Suite extension built with the **Montoya API 2026.7**.

## Features

- Adds a **STAR AI** suite tab.
- Configure API URL, API token, Project ID, and Scope ID.
- Adds **Analyze with STAR AI** to request/response context menus.
- Sends only the request/response you explicitly select.
- Performs the network call off the Swing event thread.
- Displays the backend JSON result inside Burp.
- Never logs the API token.

## Build

Requires Java 17+ and Gradle.

```bash
gradle jar
```

Output:

```text
build/libs/star-burp-ai-0.2.0.jar
```

## Load into Burp

1. Open **Extensions**.
2. Add a Java extension.
3. Select the generated JAR.
4. Open the **STAR AI** tab.
5. Set the API URL and API token.
6. Set the Project ID and an authorized Scope ID.
7. Right-click a request/response and choose **Analyze with STAR AI**.

The extension does not automatically export Proxy history. You choose each item sent to STAR CYBER AI X.
