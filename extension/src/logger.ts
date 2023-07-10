import * as vscode from 'vscode';

let panel: vscode.OutputChannel | undefined;

export function appendToLog(level: 'info' | 'warn' | 'error', msg: string, err?: Error): void {
    if (!panel) {
        panel = vscode.window.createOutputChannel('TypeDocLivePreview');
    }

    panel.appendLine(`[${level}] ${msg}` + (err ? `[${err.name}] ${err.message} ${err.stack}` : ''));
}