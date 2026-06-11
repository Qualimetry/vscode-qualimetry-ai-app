import * as vscode from 'vscode';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const MCP_SERVER_NAME = 'qualimetry';
const HEADER_NAME = 'qualimetry-access-token';
const DEFAULT_URL = 'https://myorg.qualimetry.io/mcp/';
const TOKEN_SECRET_KEY = 'qualimetry.accessToken';
const TOKEN_INPUT_ID = 'qualimetry-token';

// VS Code and Cursor want their MCP config in different places and different
// shapes:
//   - VS Code: extensions register servers through the McpServerDefinitionProvider
//     API (user scope; token kept in SecretStorage), or a workspace
//     .vscode/mcp.json whose top-level key is "servers". ~/.vscode/mcp.json is
//     NOT a location VS Code reads.
//   - Cursor: ~/.cursor/mcp.json (user) or <ws>/.cursor/mcp.json (workspace),
//     top-level key "mcpServers".
function isCursor(): boolean {
    return vscode.env.appName.toLowerCase().includes('cursor');
}

interface CursorMcpFile {
    mcpServers?: Record<string, { url: string; headers?: Record<string, string>; type?: string }>;
}

interface VsCodeMcpFile {
    servers?: Record<string, { url: string; headers?: Record<string, string>; type?: string }>;
    inputs?: Array<{ id: string; type: string; description?: string; password?: boolean }>;
}

const serverDefinitionsChanged = new vscode.EventEmitter<void>();

export function activate(context: vscode.ExtensionContext): void {
    context.subscriptions.push(
        serverDefinitionsChanged,
        vscode.commands.registerCommand('qualimetry.setup', () => runSetup(context)),
        vscode.commands.registerCommand('qualimetry.installSkills', () => installSkills(context)),
        vscode.commands.registerCommand('qualimetry.complianceCheck', () => complianceCheckHint())
    );

    if (!isCursor() && typeof vscode.lm.registerMcpServerDefinitionProvider === 'function') {
        context.subscriptions.push(
            vscode.lm.registerMcpServerDefinitionProvider('qualimetry', {
                onDidChangeMcpServerDefinitions: serverDefinitionsChanged.event,
                provideMcpServerDefinitions: () => provideServers(context)
            })
        );
    }

    void (async () => {
        if (!(await hasQualimetryConfigured(context))) {
            const action = 'Configure';
            const choice = await vscode.window.showInformationMessage(
                'Qualimetry: configure to get started',
                action
            );
            if (choice === action) {
                void vscode.commands.executeCommand('qualimetry.setup');
            }
        }
    })();
}

export function deactivate(): void {
    /* no-op */
}

async function provideServers(context: vscode.ExtensionContext): Promise<vscode.McpServerDefinition[]> {
    const url = vscode.workspace.getConfiguration('qualimetry').get<string>('mcpServerUrl', '');
    if (!url) {
        return [];
    }
    const token = await context.secrets.get(TOKEN_SECRET_KEY);
    if (!token) {
        return [];
    }
    return [
        new vscode.McpHttpServerDefinition(MCP_SERVER_NAME, vscode.Uri.parse(url), {
            [HEADER_NAME]: token
        })
    ];
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

    let where: string;
    try {
        if (isCursor()) {
            const target = cursorMcpJsonPath(scope);
            upsertCursorMcpEntry(target, normalisedUrl, token.trim());
            where = target;
        } else if (scope === 'workspace') {
            const target = vscodeWorkspaceMcpJsonPath();
            upsertVsCodeMcpEntry(target, normalisedUrl);
            // The workspace file references the token via a VS Code "inputs"
            // prompt so the secret never lands in a file that might be
            // committed. Seed SecretStorage too so the user-scope provider
            // works if they later flip the scope setting.
            await context.secrets.store(TOKEN_SECRET_KEY, token.trim());
            where = target;
        } else {
            await context.secrets.store(TOKEN_SECRET_KEY, token.trim());
            where = 'VS Code MCP registry (token in secret storage)';
        }
    } catch (err) {
        const detail = err instanceof Error ? err.message : String(err);
        vscode.window.showErrorMessage(`Qualimetry: setup failed: ${detail}`);
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

    serverDefinitionsChanged.fire();

    const skillsAction = 'Install Skills';
    const choice = await vscode.window.showInformationMessage(
        `Qualimetry configured (${where}). Skills are bundled with this extension — install them into ~/.agents/skills/ to enable agent workflows.`,
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

async function hasQualimetryConfigured(context: vscode.ExtensionContext): Promise<boolean> {
    if (isCursor()) {
        if (cursorEntryExists(cursorMcpJsonPath('user'))) {
            return true;
        }
        const ws = tryCursorWorkspacePath();
        return !!ws && cursorEntryExists(ws);
    }
    const url = vscode.workspace.getConfiguration('qualimetry').get<string>('mcpServerUrl', '');
    if (url && (await context.secrets.get(TOKEN_SECRET_KEY))) {
        return true;
    }
    const ws = tryVsCodeWorkspacePath();
    if (ws && fs.existsSync(ws)) {
        try {
            const data = JSON.parse(fs.readFileSync(ws, 'utf8')) as VsCodeMcpFile;
            if (data.servers?.[MCP_SERVER_NAME]?.url) {
                return true;
            }
        } catch {
            /* unreadable file = not configured */
        }
    }
    return false;
}

function cursorEntryExists(p: string | undefined): boolean {
    if (!p || !fs.existsSync(p)) {
        return false;
    }
    try {
        const data = JSON.parse(fs.readFileSync(p, 'utf8')) as CursorMcpFile;
        const entry = data.mcpServers?.[MCP_SERVER_NAME];
        return !!entry && !!entry.url && entry.url.startsWith('http');
    } catch {
        return false;
    }
}

function workspaceFolderPath(): string {
    const folder = vscode.workspace.workspaceFolders?.[0];
    if (!folder) {
        throw new Error('No workspace folder is open; switch the qualimetry.scope setting to "user".');
    }
    return folder.uri.fsPath;
}

function cursorMcpJsonPath(scope: 'user' | 'workspace'): string {
    if (scope === 'workspace') {
        return path.join(workspaceFolderPath(), '.cursor', 'mcp.json');
    }
    return path.join(os.homedir(), '.cursor', 'mcp.json');
}

function vscodeWorkspaceMcpJsonPath(): string {
    return path.join(workspaceFolderPath(), '.vscode', 'mcp.json');
}

function tryCursorWorkspacePath(): string | undefined {
    const folder = vscode.workspace.workspaceFolders?.[0];
    return folder ? path.join(folder.uri.fsPath, '.cursor', 'mcp.json') : undefined;
}

function tryVsCodeWorkspacePath(): string | undefined {
    const folder = vscode.workspace.workspaceFolders?.[0];
    return folder ? path.join(folder.uri.fsPath, '.vscode', 'mcp.json') : undefined;
}

function ensureTrailingMcp(url: string): string {
    if (/\/mcp\/?$/.test(url)) {
        return url.endsWith('/') ? url : url + '/';
    }
    return url.replace(/\/?$/, '') + '/mcp/';
}

function readJsonFile<T>(file: string): T | undefined {
    if (!fs.existsSync(file)) {
        return undefined;
    }
    try {
        return JSON.parse(fs.readFileSync(file, 'utf8')) as T;
    } catch {
        return undefined;
    }
}

function upsertCursorMcpEntry(file: string, url: string, token: string): void {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const data = readJsonFile<CursorMcpFile>(file) ?? {};
    data.mcpServers = data.mcpServers ?? {};
    data.mcpServers[MCP_SERVER_NAME] = {
        type: 'http',
        url,
        headers: { [HEADER_NAME]: token }
    };
    fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n', { encoding: 'utf8' });
}

function upsertVsCodeMcpEntry(file: string, url: string): void {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const data = readJsonFile<VsCodeMcpFile>(file) ?? {};
    data.servers = data.servers ?? {};
    data.servers[MCP_SERVER_NAME] = {
        type: 'http',
        url,
        headers: { [HEADER_NAME]: `\${input:${TOKEN_INPUT_ID}}` }
    };
    data.inputs = data.inputs ?? [];
    if (!data.inputs.some(i => i.id === TOKEN_INPUT_ID)) {
        data.inputs.push({
            id: TOKEN_INPUT_ID,
            type: 'promptString',
            description: 'Qualimetry access token',
            password: true
        });
    }
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
