import * as vscode from 'vscode';
import { ShowPreviewCommand } from './showPreviewCommand';

export function activate(context: vscode.ExtensionContext) {
    new ShowPreviewCommand(context);
}

// This method is called when your extension is deactivated
export function deactivate() { }
