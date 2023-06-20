import * as vscode from 'vscode';
import * as MarkdownIt from 'markdown-it';
import { debounce, throttle } from './utils';
import { typeDocToMarkdown } from './typedoc2md';

type VsCodeTheme = 'light' | 'dark';

export class ShowPreviewCommand {
    private readonly id = 'typedocLivePreview.showPreview';
    private readonly viewType = 'typedocLivePreview.preview';

    private webviewPanel?: vscode.WebviewPanel;
    private md: MarkdownIt;
    private readonly _extensionUri: vscode.Uri;
    private vsTheme: VsCodeTheme = 'light';

    constructor(private readonly context: vscode.ExtensionContext) {

        this.md = new MarkdownIt({
            html: false,
            breaks: true,
            linkify: true,
        });
        this._extensionUri = context.extensionUri;

        context.subscriptions.push(vscode.commands.registerCommand(this.id, () => this.execute()));
    }

    execute(): void {
        this.createWebviewPanel();
        this.updatePreview();
        this.registerEvents();
    }

    private createWebviewPanel() {
        if (this.webviewPanel) { return; }

        const { activeTextEditor } = vscode.window;
        const viewColumn = activeTextEditor && activeTextEditor.viewColumn ? activeTextEditor.viewColumn + 1 : vscode.ViewColumn.One;
        const webviewPanel = vscode.window.createWebviewPanel(
            this.viewType,
            'TypeDoc: Live Preview',
            viewColumn,
            {
                enableFindWidget: true,
                enableScripts: true,
                enableCommandUris: true,
            }
        );

        webviewPanel.onDidDispose(() => {
            this.webviewPanel = undefined;
        }, null, this.context.subscriptions);

        webviewPanel.onDidChangeViewState(e => {
            if (this.webviewPanel?.visible) {
                this.updatePreview();
            }
        });

        this.webviewPanel = webviewPanel;
    }

    private async updatePreview(): Promise<void> {
        const activeEditor = vscode.window.activeTextEditor;

        if (!activeEditor || !this.webviewPanel) { return; }

        const lineNumber = activeEditor.selection.active.line;

        const markdown = await typeDocToMarkdown(activeEditor.document.fileName, lineNumber);
        const html = this.md.render(markdown);
        this.webviewPanel.webview.html = this.wrapHTMLContentInDoc(this.webviewPanel.webview, html);
    }

    private getMediaUri(webview: vscode.Webview, filename: string, themed: boolean): vscode.Uri {
        const diskPath = themed
            ? vscode.Uri.joinPath(this._extensionUri, 'media', this.vsTheme, filename)
            : vscode.Uri.joinPath(this._extensionUri, 'media', filename);
        return webview.asWebviewUri(diskPath);
    }

    private wrapHTMLContentInDoc(webview: vscode.Webview, html: string): string {
        const nonce = this.getNonce();

        const idx = html.lastIndexOf('<h2>Source</h2>');
        if (idx > -1) {
            html = html.substring(0, idx);
        }
        const regex = /<code>/g;
        html = html.replace(regex, '<code class="language-ts">');

        const githubMarkdownCssUri = this.getMediaUri(webview, 'github-markdown.css', true);
        const highlightCssUri = this.getMediaUri(webview, 'highlight-github.min.css', true);
        const globalCssUri = this.getMediaUri(webview, 'global.css', false);

        const libJsUri = this.getMediaUri(webview, 'lib.js', false);
        const highlightJsUri = this.getMediaUri(webview, 'highlight.min.js', false);
        const highlightTscJsUri = this.getMediaUri(webview, 'highlight-tsc.min.js', false);

        return `<!DOCTYPE html>
			<html lang="en">
            <head>
				<meta charset="UTF-8">
				<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';">

				<meta name="viewport" content="width=device-width, initial-scale=1.0">

				<link href="${githubMarkdownCssUri}" rel="stylesheet">
				<link href="${highlightCssUri}" rel="stylesheet">
                <link href="${globalCssUri}" rel="stylesheet">

                <script nonce="${nonce}" src="${highlightJsUri}"></script>
                <script nonce="${nonce}" src="${highlightTscJsUri}"></script>

				<title>TypeDoc: Live Preview</title>
			</head>
			<body class="markdown-body">
                ${html}
                <script nonce="${nonce}" src="${libJsUri}"></script>
			</body>
			</html>`;
    }

    private getNonce(): string {
        let text = '';
        const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        for (let i = 0; i < 32; i++) {
            text += possible.charAt(Math.floor(Math.random() * possible.length));
        }
        return text;
    }

    private isSupportedFileOpened(): boolean {
        const { activeTextEditor } = vscode.window;
        return activeTextEditor?.document.languageId === 'typescript';
    }

    private registerEvents() {
        const throttledUpdate = throttle(this.updatePreview.bind(this), 1000);
        const debouncedUpdate = debounce(this.updatePreview.bind(this), 500);
        this.context.subscriptions.push(
            vscode.workspace.onDidChangeTextDocument(() => {
                throttledUpdate();
                debouncedUpdate();
            }),
            vscode.window.onDidChangeActiveTextEditor(() => this.isSupportedFileOpened() && this.updatePreview())
        );
    }
}