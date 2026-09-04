# Changelog - Qualimetry AI App for VS Code & Cursor

## [1.3.0] - 2026-09-05

### Added

- **Security hotspots.** The agent can now see the security hotspots your analysis raises: security-sensitive code that needs a person to decide whether it is safe. They were never returned by the issue tools, so a branch reported as clear of issues could still have every hotspot outstanding. The bundled `analysis-issues` skill works through them after the issues and gives you an assessment per hotspot, with the rule's risk description and fix recommendations behind it. Recording the review decision stays with you in Qualimetry.
- **Suppression-aware dependency work.** The bundled `dependency-check` skill reads the suppressions that cover your branch. A CVE whose suppression is still waiting for approval is reported rather than fixed, and an approved suppression expiring within 15 days is flagged before the finding returns. Ask and the agent will list what has been suppressed, by whom, why and until when. Raising and approving suppressions remains a human step in the Qualimetry dashboard.
- **Dependency findings are marked as such.** Analysis findings that came from the dependency scan are now labelled and handed to the dependency workflow, which knows the package version and the upgrade path.

### Changed

- Setup verification now expects 21 MCP tools on Qualimetry Enterprise; Qualimetry AI is unchanged at 12.
- Both updated skills skip their new steps with a one-line note when the Qualimetry deployment is older than the tools, so nothing breaks before your server is upgraded.

## [1.2.0] - 2026-06-11

### Fixed

- **"Qualimetry: Setup" now registers the MCP server correctly in both editors.** In VS Code, the server is provided through VS Code's MCP server definition provider API, with your access token kept in encrypted secret storage (user scope) or referenced via a secure prompt in `.vscode/mcp.json` so it is never written to a workspace file (workspace scope). In Cursor, setup writes Cursor's native `~/.cursor/mcp.json` (or `.cursor/mcp.json` for workspace scope). Previously the entry was written to a location neither editor reads.
- Fixed an activation error when the editor was opened without a folder.
- The bundled configuration snippets and documentation now show each editor's actual MCP configuration format and file locations.

### Changed

- Requires VS Code 1.102 or later (needed for the MCP server definition provider API). Cursor is unaffected.

## [1.1.2] - 2026-06-11

### Changed

- Bundled skills updated for the renamed `get_coding_standards_blitzy` MCP tool (formerly `get_language_coding_standards_blitzy`). The Blitzy coding-standards pack now carries a top-level `license` notice, and language coding standards are returned only when `languageCodes` are supplied — omit them to receive policies and principles only.

## [1.1.1] - 2026-06-06

### Added

- Pull-request-scoped issue retrieval. The bundled `analysis-issues` and `review-check` skills document an optional `pullRequest` parameter so an agent on a PR branch can fetch the issues raised on the pull request's new code. The PR number is resolved with **standard git only** — `git ls-remote` against the host's PR refs (GitHub, GitLab, Bitbucket Server) — so no GitHub/Azure/Bitbucket CLI is required.

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
