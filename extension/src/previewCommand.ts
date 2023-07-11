import * as vscode from 'vscode';
import * as path from 'path';
import MarkdownIt from 'markdown-it';
import { getUri, context, webViewPanelType, getMediaUri, setTheme, getConfig, isTypescriptFile, VsCodeLogger } from './shared';
import { asyncDebounce } from './utils';
import { PreviewUpdateMode, convertTypeDocToMarkdown, getLastConvertedFile, isDifferentFile, resetCache } from './converter';
import { PostMessage } from './types';

let debouncedUpdatePreview: Function;
// eslint-disable-next-line @typescript-eslint/naming-convention
let deb_updatePreviewCursorChanged: Function;

const emptyContentHint = `<div class="hint-panel">
<span>Place text cursor within <b>typescript comment</b> to see its preview</span>
</div>`;

const loadingHtml = `<div style="width: 16px; height: 16px;">
<svg fill="#6495ed" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><style>@keyframes spinner_MGfb{93.75%{opacity:.2}}.spinner_S1WN{animation:spinner_MGfb .8s linear infinite;animation-delay:-.8s}</style><circle cx="4" cy="12" r="3" class="spinner_S1WN"/><circle cx="12" cy="12" r="3" class="spinner_S1WN" style="animation-delay:-.65s"/><circle cx="20" cy="12" r="3" class="spinner_S1WN" style="animation-delay:-.5s"/></svg>
</div>`;

/**
 * show preview command
 */
export class ShowPreviewCommand {
    private webviewPanel?: vscode.WebviewPanel;
    private md!: MarkdownIt;

    private lastFile = '';
    private currentFile = '';
    private lastMessage?: PostMessage;
    private logger = new VsCodeLogger();


    constructor() {
        this.md = new MarkdownIt({
            html: false,
            breaks: true,
            linkify: true,
        });
        this.reset();
    }

    private reset(): void {
        this.lastFile = '';
        this.currentFile = '';
        this.lastMessage = undefined;
    }

    show({ viewColumn, fsPath, textEditor }: { viewColumn?: vscode.ViewColumn, fsPath?: string, textEditor?: vscode.TextEditor }): void {
        this.currentFile = textEditor ? textEditor.document.uri.fsPath : fsPath!;
        this.createWebviewPanel(viewColumn);
        //this.resetWebviewPanel('loading');
        this.updatePreviewWindow('content', textEditor);
        this.registerEvents();
    }

    public dispose() {
        this.webviewPanel?.dispose();
        this.webviewPanel = undefined;
    }

    private createWebviewPanel(viewColumn?: vscode.ViewColumn) {
        if (this.webviewPanel) { return; }

        const webviewPanel = vscode.window.createWebviewPanel(
            webViewPanelType,
            'TypeDoc: Live Preview',
            viewColumn ?? vscode.ViewColumn.One,
            {
                enableFindWidget: true,
                enableScripts: true,
                enableCommandUris: true,
                //retainContextWhenHidden: true,
                localResourceRoots: [
                    getUri('media')
                ]
            }
        );

        webviewPanel.onDidDispose(() => {
            this.webviewPanel = undefined;
            this.reset();
            resetCache();
        }, null, context.subscriptions);

        webviewPanel.onDidChangeViewState(e => {
            if (this.webviewPanel?.visible && debouncedUpdatePreview) {
                deb_updatePreviewCursorChanged();
            }
        });

        webviewPanel.webview.onDidReceiveMessage(message => {
            switch (message.command) {
                case 'reload':
                    this.reload({ ...message });
                    return;
            }
        });

        this.webviewPanel = webviewPanel;
    }

    public async reload(options?: { file: string, isUntitled: boolean }) {
        this.resetWebviewPanel('loading', true);
        let file = options?.file;
        let isUntitled = options?.isUntitled;

        if (options === undefined) {
            if (this.lastMessage) {
                file = this.lastMessage.file;
                isUntitled = this.lastMessage.isUntitled;
            } else {
                if (vscode.window.activeTextEditor && isTypescriptFile(vscode.window.activeTextEditor?.document)) {
                    this.show({ viewColumn: vscode.ViewColumn.Beside, textEditor: vscode.window.activeTextEditor });
                }
            }
        }

        if (file && isUntitled !== undefined) {
            const editor = vscode.window.visibleTextEditors.find(x => x.document.fileName === file && x.document.isUntitled === isUntitled);
            if (editor) {
                this.updatePreviewWindow('content', editor);
            }
        }
    }

    private async updatePreview(): Promise<void> {
        await this.updatePreviewWindow('content');
    }

    private async updatePreviewCursorChanged(): Promise<void> {
        await this.updatePreviewWindow('cursor');
    }

    private async updatePreviewWindow(updateMode: PreviewUpdateMode, textEditor?: vscode.TextEditor): Promise<void> {
        try {
            this.lastFile = this.currentFile;
            const activeEditor = textEditor ?? vscode.window.activeTextEditor;
            if (!activeEditor || !this.webviewPanel) { return; }

            let lineNumber = 1;
            let originFilename = '';
            let isUntitled = false;

            if (!this.isSupportedFileOpened(textEditor)) {
                return;
            }
            lineNumber = activeEditor.selection.active.line + 1;
            originFilename = activeEditor.document.fileName;
            isUntitled = activeEditor.document.isUntitled;

            const title = `TypeDoc Preview - ${path.parse(originFilename).base}`;
            this.webviewPanel.title = title;

            if (isDifferentFile(originFilename)) {
                this.resetWebviewPanel('loading', false);
            }

            const tempFileUri = getUri('preview.ts');
            const tempfile = tempFileUri.fsPath;
            const editorText = activeEditor.document.getText();

            await this.saveTempFile(tempFileUri, editorText);

            const config = getConfig();
            config.logging = false;
            config.logger = this.logger;
            const markdown = await convertTypeDocToMarkdown(tempfile, originFilename, lineNumber, updateMode, config);
            const html = this.md.render(markdown);

            if (!this.webviewPanel || !this.webviewPanel.webview) { return; }

            const htmlContent = this.wrapHTMLContentInDoc(this.webviewPanel.webview, html);
            this.lastMessage = {
                command: 'update',
                file: originFilename,
                line: lineNumber,
                isEmpty: htmlContent.isEmpty,
                isUntitled: isUntitled
            };

            this.webviewPanel.webview.html = htmlContent.html;
            this.webviewPanel.webview.postMessage(this.lastMessage);
        } catch (error) {
            this.logger.log('error', 'Failed to convert typedoc to markdown', error as Error);
        }
    }

    private resetWebviewPanel(type: 'loading' | 'empty', updateTitle: boolean): void {
        if (this.webviewPanel && this.webviewPanel.webview) {
            if (updateTitle) {
                let title = `TypeDoc Preview2`;
                if (type === 'loading') {
                    const file = this.lastMessage?.file ?? '';
                    if (file !== '') {
                        title = `TypeDoc Preview2 - ` + path.parse(file).base;
                    }
                }
                this.webviewPanel.title = title;
            }

            this.webviewPanel.webview.html = type === 'loading' ? loadingHtml : this.wrapHTMLContentInDoc(this.webviewPanel.webview, emptyContentHint).html;

            if (type === 'empty') {
                this.lastMessage = {
                    command: 'update',
                    file: '',
                    line: 1,
                    isEmpty: true,
                    isUntitled: false
                };
                this.webviewPanel.webview.postMessage(this.lastMessage);
            }
        }
    }

    private async saveTempFile(file: vscode.Uri, text: string): Promise<void> {
        await vscode.workspace.fs.writeFile(file, Buffer.from(text, 'utf8'));
    }

    private wrapHTMLContentInDoc(webview: vscode.Webview, html: string): { html: string, isEmpty: boolean } {
        const nonce = this.getNonce();

        const githubMarkdownCssUri = getMediaUri(webview, 'github-markdown.css', true);
        const highlightCssUri = getMediaUri(webview, 'highlight-github.min.css', true);
        const globalCssUri = getMediaUri(webview, 'global.css', false);

        const pageJsUri = getMediaUri(webview, 'page.js', false);
        const highlightJsUri = getMediaUri(webview, 'highlight.min.js', false);
        const highlightTscJsUri = getMediaUri(webview, 'highlight-tsc.min.js', false);

        html = html.trim();
        let isEmpty = html.length === 0;
        if (isEmpty) {
            html = emptyContentHint;
        }

        html = `<!DOCTYPE html>
			<html lang="en">
            <head>
				<meta charset="UTF-8">
				<meta http-equiv="Content-Security-Policy" content="default-src vscode-resource:; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';">
                

				<meta name="viewport" content="width=device-width, initial-scale=1.0">

				<link href="${githubMarkdownCssUri}" rel="stylesheet">
				<link href="${highlightCssUri}" rel="stylesheet">
                <link href="${globalCssUri}" rel="stylesheet">

                <script nonce="${nonce}" src="${highlightJsUri}"></script>
                <script nonce="${nonce}" src="${highlightTscJsUri}"></script>

				<title>TypeDoc: Live Preview</title>
			</head>
			<body class="markdown-body">
                <header>
                    <a href="#" class="btn btn-reload" title="Reload" id="btnReload">&nbsp;</a>
                </header>
                <div class="content">
                    ${html}
                </div>
                <footer>
                    Powered by <a href="https://typedoc.org" class="typedoclogo" target="_blank">TypeDoc</a>
                </footer>
                <script nonce="${nonce}" src="${pageJsUri}"></script>
			</body>
			</html>`;

        return { html, isEmpty };
    }

    private getNonce(): string {
        let text = '';
        const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        for (let i = 0; i < 32; i++) {
            text += possible.charAt(Math.floor(Math.random() * possible.length));
        }
        return text;
    }

    private isSupportedFileOpened(textEditor?: vscode.TextEditor): boolean {
        const activeTextEditor = textEditor ?? vscode.window.activeTextEditor;
        return activeTextEditor?.document.languageId === 'typescript';
    }

    private registerEvents() {
        debouncedUpdatePreview = asyncDebounce(this.updatePreview.bind(this), 500, { leading: false, trailing: true, maxWait: 1000 }) as unknown as Function;
        // eslint-disable-next-line @typescript-eslint/naming-convention
        deb_updatePreviewCursorChanged = asyncDebounce(this.updatePreviewCursorChanged.bind(this), 100, { leading: false, trailing: true, maxWait: 1000 }) as unknown as Function;

        context.subscriptions.push(
            vscode.window.onDidChangeActiveColorTheme(theme => {
                setTheme(theme.kind);
                if (this.lastMessage) {
                    this.reload({ ...this.lastMessage });
                }
            }),

            vscode.workspace.onDidChangeTextDocument(() => {
                // @ts-ignore
                debouncedUpdatePreview();
            }),
            vscode.window.onDidChangeActiveTextEditor(e => {
                if (e && e.document) {
                    this.currentFile = e.document.fileName;
                }

                const supportedFile = this.isSupportedFileOpened(e);
                if (!supportedFile || this.currentFile !== this.lastFile) {
                    this.updatePreviewWindow('content', e);
                } else {
                    debouncedUpdatePreview();
                }
            }),

            vscode.window.onDidChangeTextEditorSelection(() => {
                deb_updatePreviewCursorChanged();
            }),

            vscode.window.onDidChangeVisibleTextEditors(() => {
                const lastConvertedFile = getLastConvertedFile();
                if (!vscode.window.visibleTextEditors.some(x => x.document.fileName === lastConvertedFile)) {
                    //this.resetWebviewPanel('empty');
                }
            }),
        );
    }
}

export const previewPanel = new ShowPreviewCommand();