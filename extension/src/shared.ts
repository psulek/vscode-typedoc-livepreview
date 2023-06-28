import * as vscode from 'vscode';
import * as path from 'path';

export type VsCodeTheme = 'light' | 'dark';

export const webViewPanelType = 'typedocPreview';

export let context: vscode.ExtensionContext;
export let theme: VsCodeTheme = 'light';

const supportedExtensions = ['.ts', '.mts', '.tsx', '.mtsx'];

export function init(ctx: vscode.ExtensionContext): void {
    context = ctx;
}

export function isTypescriptFile(uriOrDocument: vscode.Uri | vscode.TextDocument): boolean {
    //return activeTextEditor?.document.languageId === 'typescript';
    let uri: vscode.Uri;
    if ('uri' in uriOrDocument) {
        uri = uriOrDocument.uri;
    } else {
        uri = uriOrDocument;
    }

    return uri ? supportedExtensions.includes(path.extname(uri.fsPath)) : false;
}

export const getUri = (relativePath: string): vscode.Uri =>
    vscode.Uri.joinPath(context.extensionUri, relativePath);


export const getMediaUri = (webview: vscode.Webview, filename: string, themed: boolean): vscode.Uri => {
    const diskPath = themed
        ? vscode.Uri.joinPath(context.extensionUri, 'media', theme, filename)
        : vscode.Uri.joinPath(context.extensionUri, 'media', filename);
    return webview.asWebviewUri(diskPath);
};