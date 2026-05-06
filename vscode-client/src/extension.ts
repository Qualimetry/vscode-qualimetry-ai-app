import * as vscode from 'vscode';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const MCP_SERVER_NAME = 'qualimetry';
const HEADER_NAME = 'qualimetry-access-token';
const DEFAULT_URL = 'https://myorg.qualimetry.io/mcp/';

interface McpServerEntry {
    url: string;
    headers: Record<string, string>;
    type?: string;
}

interface McpFile {
    mcpServers?: Record<string, McpServerEntry>;
}

export function activate(context: vscode.ExtensionContext): void {
    context.subscriptions.push(
        vscode.commands.registerCommand('qualimetry.setup', () => runSetup(context)),
        vscode.commands.registerCommand('qualimetry.installSkills', () => installSkills(context)),
        vscode.commands.registerCommand('qualimetry.complianceCheck', () => complianceCheckHint())
    );

    if (!hasQualimetryConfigured()) {
        const action = 'Configure';
        vscode.window
            .showInformationMessage(
                'Qualimetry: configure to get started',
                action
            )
            .then(choice => {
                if (choice === action) {
                    void vscode.commands.executeCommand('qualimetry.setup');
                }
            });
    }
}

export function deactivate(): void {
    /* no-op */
}

async function runSetup(context: vscode.ExtensionContext): Promise<void> {
    const url = await vscode.window.showInputBox({
        prompt: 'Qualimetry server URL',
        placeHolder: DEFAULT_URL,
        value: DEFAULT_URL,
        ignoreFocusOut: true,
        validateInput: v =>
            v && /^https?:\/\/.+/.test(v.trim()) ? null : 'Enter a full URL (https://...).'
    });
    if (!url) {
        return;
    }

    const token = await vscode.window.showInputBox({
        prompt: 'Qualimetry access token',
        placeHolder: 'Paste; the value will be hidden.',
        password: true,
        ignoreFocusOut: true,
        validateInput: v => (v && v.trim().length > 0 ? null : 'Token cannot be empty.')
    });
    if (!token) {
        return;
    }

    const normalisedUrl = ensureTrailingMcp(url.trim());
    const scope = vscode.workspace
        .getConfiguration('qualimetry')
        .get<'user' | 'workspace'>('scope', 'user');
    const target = resolveMcpJsonPath(scope);

    try {
        upsertMcpEntry(target, normalisedUrl, token.trim());
    } catch (err) {
        const detail = err instanceof Error ? err.message : String(err);
        vscode.window.showErrorMessage(`Qualimetry: failed to write ${target}: ${detail}`);
        return;
    }

    await vscode.workspace
        .getConfiguration('qualimetry')
        .update(
            'mcpServerUrl',
            normalisedUrl,
            scope === 'workspace'
                ? vscode.ConfigurationTarget.Workspace
                : vscode.ConfigurationTarget.Global
        );

    const skillsAction = 'Install Skills';
    const choice = await vscode.window.showInformationMessage(
        `Qualimetry configured (${target}). Skills are bundled with this extension — install them into ~/.agents/skills/ to enable agent workflows.`,
        skillsAction
    );
    if (choice === skillsAction) {
        await installSkills(context);
    }
}

async function installSkills(context: vscode.ExtensionContext): Promise<void> {
    const source = path.join(context.extensionPath, 'resources', 'skills');
    if (!fs.existsSync(source)) {
        vscode.window.showErrorMessage(
            `Qualimetry: bundled skills not found at ${source}. Reinstall the extension.`
        );
        return;
    }

    const target = path.join(os.homedir(), '.agents', 'skills');
    fs.mkdirSync(target, { recursive: true });

    let copied = 0;
    for (const skillDir of fs.readdirSync(source)) {
        const srcPath = path.join(source, skillDir);
        if (!fs.statSync(srcPath).isDirectory()) {
            continue;
        }
        const dstPath = path.join(target, skillDir);
        fs.rmSync(dstPath, { recursive: true, force: true });
        copyDirSync(srcPath, dstPath);
        copied += 1;
    }

    vscode.window.showInformationMessage(
        `Qualimetry: installed ${copied} skill(s) to ${target}.`
    );
}

function complianceCheckHint(): void {
    vscode.window.showInformationMessage(
        'Use Copilot Chat: ask "Run /review-check on the current file" or "Use the qualimetry coding-standards skill on this file." The bundled skills are in ~/.agents/skills (run "Qualimetry: Install Skills" if you have not already).'
    );
}

function hasQualimetryConfigured(): boolean {
    const userPath = resolveMcpJsonPath('user');
    if (mcpEntryExists(userPath)) {
        return true;
    }
    const workspacePath = resolveMcpJsonPath('workspace');
    if (workspacePath && mcpEntryExists(workspacePath)) {
        return true;
    }
    return false;
}

function mcpEntryExists(p: string | undefined): boolean {
    if (!p || !fs.existsSync(p)) {
        return false;
    }
    try {
        const data = JSON.parse(fs.readFileSync(p, 'utf8')) as McpFile;
        const entry = data.mcpServers?.[MCP_SERVER_NAME];
        return !!entry && !!entry.url && entry.url.startsWith('http');
    } catch {
        return false;
    }
}

function resolveMcpJsonPath(scope: 'user' | 'workspace'): string {
    if (scope === 'workspace') {
        const folder = vscode.workspace.workspaceFolders?.[0];
        if (!folder) {
            throw new Error('No workspace folder is open; switch the qualimetry.scope setting to "user".');
        }
        return path.join(folder.uri.fsPath, '.vscode', 'mcp.json');
    }
    return path.join(os.homedir(), '.vscode', 'mcp.json');
}

function ensureTrailingMcp(url: string): string {
    if (/\/mcp\/?$/.test(url)) {
        return url.endsWith('/') ? url : url + '/';
    }
    return url.replace(/\/?$/, '') + '/mcp/';
}

function upsertMcpEntry(file: string, url: string, token: string): void {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    let data: McpFile = {};
    if (fs.existsSync(file)) {
        try {
            data = JSON.parse(fs.readFileSync(file, 'utf8')) as McpFile;
        } catch {
            data = {};
        }
    }
    data.mcpServers = data.mcpServers ?? {};
    data.mcpServers[MCP_SERVER_NAME] = {
        type: 'http',
        url,
        headers: { [HEADER_NAME]: token }
    };
    fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n', { encoding: 'utf8' });
}

function copyDirSync(src: string, dst: string): void {
    fs.mkdirSync(dst, { recursive: true });
    for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
        const s = path.join(src, entry.name);
        const d = path.join(dst, entry.name);
        if (entry.isDirectory()) {
            copyDirSync(s, d);
        } else if (entry.isFile()) {
            fs.copyFileSync(s, d);
        }
    }
}
