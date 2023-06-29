import * as fs from 'node:fs/promises';
import * as vscode from 'vscode';
import * as path from 'path';
import * as MarkdownIt from 'markdown-it';
import {getUri, context, webViewPanelType, getMediaUri} from './shared';
import { asyncDebounce } from './utils';
import { PreviewUpdateMode, convertTypeDocToMarkdown, getLastFileName } from './converter';

let debouncedUpdatePreview: Function;
// eslint-disable-next-line @typescript-eslint/naming-convention
let deb_updatePreviewCursorChanged: Function;

export class ShowPreviewCommand {
    private webviewPanel?: vscode.WebviewPanel;
    //private readonly _extensionUri: vscode.Uri;
    private md!: MarkdownIt;

    private lastFile = '';

    private currentFile = '';

    //constructor(private readonly context: vscode.ExtensionContext, private readonly md: MarkdownIt) {
    constructor() {
        //this._extensionUri = context.extensionUri;

        this.md = new MarkdownIt({
            html: false,
            breaks: true,
            linkify: true,
        });
    }

    show({ viewColumn, fsPath }: { viewColumn?: vscode.ViewColumn, fsPath: string }): void {
        this.currentFile = fsPath;
        this.createWebviewPanel(viewColumn);
        this.updatePreview();
        this.registerEvents();
    }

    private createWebviewPanel(viewColumn?: vscode.ViewColumn) {
        if (this.webviewPanel) { return; }

        //const { activeTextEditor } = vscode.window;
        //const viewColumn = activeTextEditor && activeTextEditor.viewColumn ? activeTextEditor.viewColumn + 1 : vscode.ViewColumn.One;
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
                    //vscode.Uri.joinPath(this._extensionUri, 'media')
                    getUri('media')
                ]
            }
        );

        webviewPanel.onDidDispose(() => {
            this.webviewPanel = undefined;
        }, null, context.subscriptions);

        webviewPanel.onDidChangeViewState(e => {
            if (this.webviewPanel?.visible && debouncedUpdatePreview) {
                //this.updatePreview();
                //debouncedUpdatePreview();
                deb_updatePreviewCursorChanged();
            }
        });

        this.webviewPanel = webviewPanel;
    }

    // private get currentFile(): string {
    //     return vscode.window.activeTextEditor?.document?.fileName ?? '';
    // }

    private async updatePreview(): Promise<void> {
        await this.updatePreviewWindow('content');
    }

    private async updatePreviewCursorChanged(): Promise<void> {
        await this.updatePreviewWindow('cursor');
    }

    private async updatePreviewWindow(updateMode: PreviewUpdateMode): Promise<void> {
        this.lastFile = this.currentFile;
        const activeEditor = vscode.window.activeTextEditor;
        if (!activeEditor || !this.webviewPanel) { return; }

        // updateCounter++;
        // const now = Date.now();
        // const updateDelta = updateCounterLastDate === 0 ? 0 : now - updateCounterLastDate;
        // updateCounterLastDate = now;

        // console.warn(`${this.id}.updateCounter: ${updateCounter }, update delta: ${updateDelta}ms`);

        let html = '';
        if (this.isSupportedFileOpened()) {
            const lineNumber = activeEditor.selection.active.line + 1;
            const originFilename = activeEditor.document.fileName;
            //const originFilename = this.currentFile;

            this.webviewPanel.title = `TypeDoc: ` + path.parse(originFilename).base;

            //const tempfile = path.join(this._extensionUri.fsPath, 'preview.ts');
            const tempfile = getUri('preview.ts').fsPath;
            await this.saveTempFile(tempfile, activeEditor.document.getText());

            const markdown = await convertTypeDocToMarkdown(tempfile, originFilename, lineNumber, updateMode);
            html = this.md.render(markdown);
        } else {
            html = `<p><span style="color: red;">Unsupported file <b>${this.lastFile}</b></span>.<br/> Only typescript files are supported</p>`;
        }

        if (!this.webviewPanel || !this.webviewPanel.webview) { return; }

        this.webviewPanel.webview.html = this.wrapHTMLContentInDoc(this.webviewPanel.webview, html);
    }

    private resetWebviewPanel(): void {
        if (this.webviewPanel && this.webviewPanel.webview) {
            this.webviewPanel.title = `TypeDoc: Live Preview`;
            this.webviewPanel.webview.html = '';
        }
    }

    // private getMediaUri(webview: vscode.Webview, filename: string, themed: boolean): vscode.Uri {
    //     const diskPath = themed
    //         ? vscode.Uri.joinPath(this._extensionUri, 'media', this.vsTheme, filename)
    //         : vscode.Uri.joinPath(this._extensionUri, 'media', filename);
    //     return webview.asWebviewUri(diskPath);
    // }

    private async saveTempFile(file: string, text: string): Promise<void> {
        await fs.writeFile(file, text, { encoding: 'utf-8' });
    }

    private wrapHTMLContentInDoc(webview: vscode.Webview, html: string): string {
        const nonce = this.getNonce();

        const githubMarkdownCssUri = getMediaUri(webview, 'github-markdown.css', true);
        const highlightCssUri = getMediaUri(webview, 'highlight-github.min.css', true);
        const globalCssUri = getMediaUri(webview, 'global.css', false);

        const libJsUri = getMediaUri(webview, 'lib.js', false);
        const highlightJsUri = getMediaUri(webview, 'highlight.min.js', false);
        const highlightTscJsUri = getMediaUri(webview, 'highlight-tsc.min.js', false);
        //<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';">

        return `<!DOCTYPE html>
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
                <div class="content">
                    ${html}
                </div>
                <footer>
                    Powered by <a href="https://typedoc.org" class="typedoclogo" target="_blank">TypeDoc</a>
                </footer>
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
        //const throttledUpdate = throttle(this.updatePreview.bind(this), 500);
        //const debouncedUpdate = debounce(this.updatePreview.bind(this), 500, {leading: false, trailing: true, maxWait: 1000});
        debouncedUpdatePreview = asyncDebounce(this.updatePreview.bind(this), 500, { leading: false, trailing: true, maxWait: 1000 }) as unknown as Function;

        // eslint-disable-next-line @typescript-eslint/naming-convention
        deb_updatePreviewCursorChanged = asyncDebounce(this.updatePreviewCursorChanged.bind(this), 100, { leading: false, trailing: true, maxWait: 1000 }) as unknown as Function;

        context.subscriptions.push(
            vscode.workspace.onDidChangeTextDocument(() => {
                //throttledUpdate();
                // @ts-ignore
                debouncedUpdatePreview();
            }),
            vscode.window.onDidChangeActiveTextEditor(e => {
                //return this.isSupportedFileOpened() && this.updatePreview();
                // @ts-ignore
                //return this.isSupportedFileOpened() && debouncedUpdatePreview();

                const supportedFile = this.isSupportedFileOpened();
                if (!supportedFile || this.currentFile !== this.lastFile) {
                    this.updatePreview();
                } else {
                    debouncedUpdatePreview();
                }

                //return debouncedUpdatePreview();
            }),

            vscode.window.onDidChangeTextEditorSelection(() => {
                //this.updatePreviewCursorChanged();
                deb_updatePreviewCursorChanged();
            }),

            vscode.window.onDidChangeVisibleTextEditors(() => {
                const lastConvertFile = getLastFileName();
                if (!vscode.window.visibleTextEditors.some(x => x.document.fileName === lastConvertFile)) {
                    this.resetWebviewPanel();
                }
            })
        );
    }
}

export const previewPanel = new ShowPreviewCommand();