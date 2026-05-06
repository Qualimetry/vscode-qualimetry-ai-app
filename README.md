# Qualimetry AI App for VS Code & Cursor

[![CI](https://github.com/Qualimetry/vscode-qualimetry-ai-app/actions/workflows/ci.yml/badge.svg)](https://github.com/Qualimetry/vscode-qualimetry-ai-app/actions/workflows/ci.yml)

Catches policy violations *before* code review, not during. The Qualimetry AI App keeps every line of code your AI assistant writes — and every reviewed file you touch — aligned with your organisation's coding standards, principles, and policies, automatically.

The same `.vsix` artefact is published to:

- **Visual Studio Marketplace** — for VS Code Stable and Insiders.
- **Open VSX Registry** — for Cursor, VSCodium, Theia, Eclipse Che, Gitpod, and any other VS Code-compatible editor.

## What it does

- **Connects your editor's AI agent to your Qualimetry server.** Once configured, Copilot Chat (in VS Code) and Cursor's chat agent can pull your organisation's coding standards, general coding principles, secure coding principles, and policies on demand for any file you're working on.
- **Keeps the AI's own code compliant from the first line.** Ask the agent to write or modify code and it silently fetches the four pillars for the file's language and applies them. High-severity violations are corrected before the code is shown to you.
- **Pulls open review findings on request.** Ask the agent "show me the qualimetry findings for this file" — it returns the violations grouped by pillar (Coding Standards, Design & Best Practice, General Principles, Secure Principles, Policies) and severity, plus a standards-compliant example of how to resolve them.
- **Triages rules-based analysis findings.** Bugs, security vulnerabilities, and code smells from your static analysis (Sonar-style severities) are accessible from chat. *(Qualimetry Enterprise.)*
- **Resolves dependency CVEs.** The agent walks vulnerable packages and proposes safe upgrades to the next non-vulnerable version. *(Qualimetry Enterprise.)*

## Benefits

- Catch policy + standards violations *during authoring* and *before review*, not after.
- AI-written code is compliant by construction — no separate "lint pass" needed.
- One install, one setup, no further configuration per repo. The setup flow uses VS Code's native input boxes — you never touch JSON.
- Same `.vsix` works for VS Code, VS Code Insiders, Cursor, VSCodium, and every Open VSX-compatible editor.

## Quick Start - VS Code

1. Open VS Code.

2. Press `Ctrl+Shift+X` (Windows / Linux) or `Cmd+Shift+X` (Mac) to open the Extensions view.

3. In the search box, type:

       @mcp:qualimetry

4. Click **Install** on the **Qualimetry AI App** extension.

5. Look for a notification in the bottom-right corner of the window that says:

       Qualimetry: configure to get started   [Configure]

   Click the blue **Configure** button.

6. A text box will appear at the top of the window. Type your Qualimetry server URL (or accept the default `https://myorg.qualimetry.io/mcp/` by pressing Enter without typing).

7. A second text box will appear, this one for your access token. The text you paste will be hidden. Paste your token and press Enter.

8. You will see a green notification confirming setup, with a button **Install Skills**. Click it once to enable the bundled agent workflows.

That's it. VS Code does not need to be restarted; the Qualimetry server is picked up automatically.

If you missed the original notification, run setup any time:

1. Press `Ctrl+Shift+P` (Windows / Linux) or `Cmd+Shift+P` (Mac) to open the Command Palette.
2. Type: `Qualimetry: Setup`
3. Press Enter on the matching entry.
4. Follow the same two prompts above.

## Quick Start - Cursor

1. Open Cursor.

2. Open the Cursor Marketplace (search for "qualimetry"), or — for manual install — paste a `qualimetry` block referencing your server URL and access token into `~/.cursor/mcp.json`. A ready-made template lives in this repo at `vscode-client/snippets/cursor-mcp.snippet.json`.

3. After install, click the **Configure** button on the toast notification, or run **Command Palette → Qualimetry: Setup** (the extension is the same `.vsix` as the VS Code build, published to Open VSX which Cursor uses).

4. Restart Cursor for the configuration to load.

## Configuration

The extension exposes two settings in **File → Preferences → Settings → Qualimetry**:

| Setting | Default | What it controls |
|---|---|---|
| `qualimetry.mcpServerUrl` | (empty) | Your Qualimetry server URL. The Setup command writes this for you. |
| `qualimetry.scope` | `user` | Where setup writes the entry: `user` (`~/.vscode/mcp.json`) or `workspace` (`<repo>/.vscode/mcp.json`). |

## Where credentials live

After setup, the URL and access token are stored in:

- VS Code: `~/.vscode/mcp.json` (user scope, default) or `<repo>/.vscode/mcp.json` (workspace scope, if you change `qualimetry.scope`).
- Cursor: `~/.cursor/mcp.json`.

Both files are the host's native MCP-server store — the same location Copilot Chat / Cursor read every other connector entry from.

## Limitation: explicit, not proactive

VS Code Copilot and Cursor do not currently expose a tool-event hook the way Claude Code and Codex do. As a result, this extension cannot automatically surface review findings the moment a reviewed file is opened. Use `/review-check <file>` in Copilot Chat / Cursor chat instead, or ask the agent to "use the qualimetry review-check skill on the current file."

## Building from source

```bash
cd vscode-client
npm install
npm run bundle
npx vsce package --allow-missing-repository
```

This produces `qualimetry-vscode-ai-app-X.Y.Z.vsix` in `vscode-client/`.

## License

Apache 2.0. See [LICENSE](LICENSE).

---

*Built on the [Qualimetry AI Skills](https://github.com/Qualimetry/qualimetry-ai-skills) workflow library.*
