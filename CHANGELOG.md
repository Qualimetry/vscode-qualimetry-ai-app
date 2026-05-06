# Changelog - Qualimetry AI App for VS Code & Cursor

## [1.0.1] - 2026-05-06

### Changed

- Homepage URL switched from qualimetry.com to qualimetry.ai across every manifest, README, and the GitHub repo About sidebar.

### Added

- `repository`, `homepage`, and `bugs` URLs in `vscode-client/package.json` so vsce can resolve relative links and the marketplace listing's sidebar populates correctly. Matches the ansible / terraform plugin pattern.

## [1.0.0] - 2026-05-05

### Added

- Initial release.
- Qualimetry MCP server registration via the `Qualimetry: Setup` command.
- `Qualimetry: Install Skills to ~/.agents/skills` command that copies the bundled skills into the universal Agent Skills path.
- `Qualimetry: Check current file for review findings` command that hints the user toward Copilot Chat for skill-driven workflows.
- First-run notification with a `[Configure]` button.
- Same `.vsix` published to both **Visual Studio Marketplace** and **Open VSX** so Cursor / VSCodium / Theia / Eclipse Che / Gitpod users install with the same artefact.
