package ai.starcyber.burp;

import burp.api.montoya.BurpExtension;
import burp.api.montoya.MontoyaApi;

public final class StarBurpExtension implements BurpExtension {
    @Override
    public void initialize(MontoyaApi api) {
        api.extension().setName("STAR CYBER AI X");

        StarConfigPanel panel = new StarConfigPanel(api);
        StarApiClient client = new StarApiClient(api, panel);

        api.userInterface().registerSuiteTab("STAR AI", panel);
        api.userInterface().registerContextMenuItemsProvider(
            new StarContextMenuProvider(api, panel, client)
        );

        api.logging().logToOutput("STAR CYBER AI X extension loaded.");
    }
}
