package ai.starcyber.burp;

import burp.api.montoya.MontoyaApi;
import burp.api.montoya.http.message.HttpRequestResponse;
import burp.api.montoya.ui.contextmenu.ContextMenuEvent;
import burp.api.montoya.ui.contextmenu.ContextMenuItemsProvider;

import javax.swing.*;
import java.awt.*;
import java.util.ArrayList;
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
        List<HttpRequestResponse> selectedItems = event.selectedRequestResponses();
        HttpRequestResponse primary = null;

        if (event.messageEditorRequestResponse().isPresent()) {
            primary = event.messageEditorRequestResponse().get().requestResponse();
        } else if (!selectedItems.isEmpty()) {
            primary = selectedItems.get(0);
        }

        if (primary == null || primary.request() == null) {
            return List.of();
        }

        List<Component> items = new ArrayList<>();
        HttpRequestResponse selected = primary;

        JMenuItem analyze = new JMenuItem("Analyze with STAR AI");
        analyze.addActionListener(ignored ->
            runAsync("analysis", () -> client.analyze(selected))
        );
        items.add(analyze);

        JMenuItem inspect = new JMenuItem("Inspect passively with STAR AI");
        inspect.addActionListener(ignored ->
            runAsync("passive inspection", () -> client.inspect(selected))
        );
        items.add(inspect);

        if (selectedItems.size() == 2) {
            HttpRequestResponse first = selectedItems.get(0);
            HttpRequestResponse second = selectedItems.get(1);
            JMenuItem compare = new JMenuItem("Compare 2 selected with STAR AI");
            compare.addActionListener(ignored ->
                runAsync("comparison", () -> client.compare(first, second))
            );
            items.add(compare);
        }

        return items;
    }

    private void runAsync(String label, Runnable action) {
        config.showResult("Queued STAR AI " + label + "...");
        CompletableFuture.runAsync(action)
            .exceptionally(ex -> {
                api.logging().logToError("STAR AI async task failed: " + ex);
                config.showResult("ERROR\n\n" + ex.getMessage());
                return null;
            });
    }
}
