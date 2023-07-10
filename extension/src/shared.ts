import * as vscode from 'vscode';
import * as path from 'path';
import { EmptySignaturesTypes, ExtensionConfig } from './types';

export type VsCodeTheme = 'light' | 'dark';

export const webViewPanelType = 'typedocPreview';

export let context: vscode.ExtensionContext;
let activeTheme: VsCodeTheme = 'light';

const supportedExtensions = ['.ts', '.mts', '.tsx', '.mtsx'];

export function init(ctx: vscode.ExtensionContext): void {
    context = ctx;
}

export function isTypescriptFile(uriOrDocument: vscode.Uri | vscode.TextDocument): boolean {
    let uri: vscode.Uri;
    const isUri = uriOrDocument instanceof vscode.Uri;
    if ('uri' in uriOrDocument) {
        uri = uriOrDocument.uri;
    } else {
        uri = uriOrDocument;
    }

    let supported = uri ? supportedExtensions.includes(path.extname(uri.fsPath)) : false;
    if (!supported && !isUri) {
        supported = uriOrDocument.languageId === 'typescript';
    }

    return supported;
}

export const configKeys = {
    emptySignatures: 'typedoclivepreview.emptySignatures'
};


export function getConfig(): ExtensionConfig {
    const cfg = vscode.workspace.getConfiguration();
    const emptySignatures = cfg.get(configKeys.emptySignatures) as string;
    return {
        hideEmptySignatures: emptySignatures === EmptySignaturesTypes.hide
    };
}

export async function updateConfig(newConfig: ExtensionConfig) {
    const emptySignatures = newConfig.hideEmptySignatures ? EmptySignaturesTypes.hide : EmptySignaturesTypes.show;

    await vscode.workspace.getConfiguration().update(configKeys.emptySignatures, emptySignatures, vscode.ConfigurationTarget.Global);
}

export function setTheme(vsThemeKind: vscode.ColorThemeKind): void {
    activeTheme = vsThemeKind === vscode.ColorThemeKind.Dark ? 'dark' : 'light';
}

export const getUri = (relativePath: string): vscode.Uri =>
    vscode.Uri.joinPath(context.extensionUri, relativePath);


export const getMediaUri = (webview: vscode.Webview, filename: string, themed: boolean): vscode.Uri => {
    const diskPath = themed
        ? vscode.Uri.joinPath(context.extensionUri, 'media', activeTheme, filename)
        : vscode.Uri.joinPath(context.extensionUri, 'media', filename);
    return webview.asWebviewUri(diskPath);
};