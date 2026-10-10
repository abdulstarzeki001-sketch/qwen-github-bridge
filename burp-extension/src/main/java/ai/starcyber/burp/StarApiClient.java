package ai.starcyber.burp;

import burp.api.montoya.MontoyaApi;
import burp.api.montoya.http.message.HttpRequestResponse;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;

final class StarApiClient {
    private static final int MAX_REQUEST_CHARS = 450_000;
    private static final int MAX_RESPONSE_CHARS = 900_000;

    private final MontoyaApi api;
    private final StarConfigPanel config;
    private final HttpClient httpClient;

    StarApiClient(MontoyaApi api, StarConfigPanel config) {
        this.api = api;
        this.config = config;
        this.httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(10))
            .build();
    }

    void analyze(HttpRequestResponse requestResponse) {
        try {
            String request = truncate(requestResponse.request().toString(), MAX_REQUEST_CHARS);
            String response = requestResponse.response() == null
                ? ""
                : truncate(requestResponse.response().toString(), MAX_RESPONSE_CHARS);

            int projectId = config.projectId();
            int scopeId = config.scopeId();
            String baseUrl = config.apiUrl();
            String token = config.apiToken();

            if (!(baseUrl.startsWith("http://") || baseUrl.startsWith("https://"))) {
                throw new IllegalArgumentException("API URL must start with http:// or https://");
            }

            String json = "{"
                + "\"project_id\":" + projectId + ","
                + "\"scope_id\":" + scopeId + ","
                + "\"request\":\"" + escapeJson(request) + "\","
                + "\"response\":\"" + escapeJson(response) + "\","
                + "\"note\":\"Sent manually from Burp Suite / STAR BURP AI\""
                + "}";

            HttpRequest.Builder builder = HttpRequest.newBuilder()
                .uri(URI.create(baseUrl + "/api/burp/analyze"))
                .timeout(Duration.ofSeconds(150))
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(json));

            if (!token.isBlank()) {
                builder.header("Authorization", "Bearer " + token);
            }

            config.showResult("Analyzing selected Burp message...");

            HttpResponse<String> result = httpClient.send(
                builder.build(),
                HttpResponse.BodyHandlers.ofString()
            );

            config.showResult("HTTP " + result.statusCode() + "\n\n" + result.body());

            if (result.statusCode() >= 200 && result.statusCode() < 300) {
                api.logging().logToOutput("STAR AI analysis completed.");
            } else {
                api.logging().logToError("STAR AI returned HTTP " + result.statusCode());
            }
        } catch (Exception ex) {
            config.showResult("ERROR\n\n" + ex.getMessage());
            api.logging().logToError("STAR AI analysis failed: " + ex);
        }
    }

    private static String truncate(String value, int maxChars) {
        if (value.length() <= maxChars) return value;
        return value.substring(0, maxChars)
            + "\n\n[STAR BURP AI: message truncated before upload]";
    }

    private static String escapeJson(String value) {
        StringBuilder out = new StringBuilder(value.length() + 128);
        for (int i = 0; i < value.length(); i++) {
            char ch = value.charAt(i);
            switch (ch) {
                case '"' -> out.append("\\\"");
                case '\\' -> out.append("\\\\");
                case '\b' -> out.append("\\b");
                case '\f' -> out.append("\\f");
                case '\n' -> out.append("\\n");
                case '\r' -> out.append("\\r");
                case '\t' -> out.append("\\t");
                default -> {
                    if (ch < 0x20) {
                        out.append(String.format("\\u%04x", (int) ch));
                    } else {
                        out.append(ch);
                    }
                }
            }
        }
        return out.toString();
    }
}
