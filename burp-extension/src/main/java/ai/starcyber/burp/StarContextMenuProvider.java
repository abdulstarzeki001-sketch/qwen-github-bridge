package ai.starcyber.burp;

import burp.api.montoya.MontoyaApi;
import burp.api.montoya.http.message.HttpRequestResponse;
import burp.api.montoya.ui.contextmenu.ContextMenuEvent;
import burp.api.montoya.ui.contextmenu.ContextMenuItemsProvider;

import javax.swing.*;
import java.awt.*;
import java.util.List;
import java.util.concurrent.CompletableFuture;

final class StarContextMenuProvider implements ContextMenuItemsProvider {
    private final MontoyaApi api;
    private final StarConfigPanel config;
    private final StarApiClient client;

    StarContextMenuProvider(MontoyaApi api, StarConfigPanel config, StarApiClient client) {
        this.api = api;
        this.config = config;
        this.client = client;
    }

    @Override
    public List<Component> provideMenuItems(ContextMenuEvent event) {
        HttpRequestResponse selected = null;

        if (event.messageEditorRequestResponse().isPresent()) {
            selected = event.messageEditorRequestResponse().get().requestResponse();
        } else if (!event.selectedRequestResponses().isEmpty()) {
            selected = event.selectedRequestResponses().get(0);
        }

        if (selected == null || selected.request() == null) {
            return List.of();
        }

        HttpRequestResponse item = selected;
        JMenuItem analyze = new JMenuItem("Analyze with STAR AI");
        analyze.addActionListener(ignored -> {
            config.showResult("Queued selected request/response for analysis...");
            CompletableFuture.runAsync(() -> client.analyze(item))
                .exceptionally(ex -> {
                    api.logging().logToError("STAR AI async task failed: " + ex);
                    config.showResult("ERROR\n\n" + ex.getMessage());
                    return null;
                });
        });

        return List.of(analyze);
    }
}
