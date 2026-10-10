package ai.starcyber.burp;

import burp.api.montoya.MontoyaApi;

import javax.swing.*;
import javax.swing.border.EmptyBorder;
import java.awt.*;

final class StarConfigPanel extends JPanel {
    private final JTextField apiUrlField;
    private final JPasswordField apiTokenField;
    private final JTextField projectIdField;
    private final JTextField scopeIdField;
    private final JTextArea resultArea;

    StarConfigPanel(MontoyaApi api) {
        super(new BorderLayout(12, 12));
        setBorder(new EmptyBorder(16, 16, 16, 16));

        apiUrlField = new JTextField(env("STAR_API_URL", "http://127.0.0.1:8080"));
        apiTokenField = new JPasswordField(env("STAR_API_TOKEN", ""));
        projectIdField = new JTextField(env("STAR_PROJECT_ID", "1"));
        scopeIdField = new JTextField(env("STAR_SCOPE_ID", "1"));

        JPanel form = new JPanel(new GridBagLayout());
        GridBagConstraints c = new GridBagConstraints();
        c.insets = new Insets(6, 6, 6, 6);
        c.fill = GridBagConstraints.HORIZONTAL;
        c.weightx = 1.0;
        c.gridx = 0;
        c.gridy = 0;

        addRow(form, c, "API URL", apiUrlField);
        addRow(form, c, "API token", apiTokenField);
        addRow(form, c, "Project ID", projectIdField);
        addRow(form, c, "Authorized Scope ID", scopeIdField);

        JLabel note = new JLabel(
            "<html>Only the request/response you explicitly send from the context menu is exported.</html>"
        );
        c.gridx = 0;
        c.gridy++;
        c.gridwidth = 2;
        form.add(note, c);

        resultArea = new JTextArea();
        resultArea.setEditable(false);
        resultArea.setLineWrap(true);
        resultArea.setWrapStyleWord(true);

        JSplitPane split = new JSplitPane(
            JSplitPane.VERTICAL_SPLIT,
            form,
            new JScrollPane(resultArea)
        );
        split.setResizeWeight(0.35);

        add(split, BorderLayout.CENTER);
        api.userInterface().applyThemeToComponent(this);
    }

    private static void addRow(JPanel panel, GridBagConstraints c, String label, JComponent component) {
        c.gridwidth = 1;
        c.weightx = 0.0;
        c.gridx = 0;
        panel.add(new JLabel(label), c);

        c.weightx = 1.0;
        c.gridx = 1;
        panel.add(component, c);
        c.gridy++;
    }

    private static String env(String key, String fallback) {
        String value = System.getenv(key);
        return value == null || value.isBlank() ? fallback : value;
    }

    String apiUrl() {
        String value = apiUrlField.getText().trim();
        while (value.endsWith("/")) {
            value = value.substring(0, value.length() - 1);
        }
        return value;
    }

    String apiToken() {
        return new String(apiTokenField.getPassword());
    }

    int projectId() {
        return parsePositive(projectIdField.getText(), "Project ID");
    }

    int scopeId() {
        return parsePositive(scopeIdField.getText(), "Scope ID");
    }

    private static int parsePositive(String raw, String field) {
        try {
            int value = Integer.parseInt(raw.trim());
            if (value < 1) throw new NumberFormatException();
            return value;
        } catch (NumberFormatException ex) {
            throw new IllegalArgumentException(field + " must be a positive integer.");
        }
    }

    void showResult(String text) {
        SwingUtilities.invokeLater(() -> {
            resultArea.setText(text);
            resultArea.setCaretPosition(0);
        });
    }
}
