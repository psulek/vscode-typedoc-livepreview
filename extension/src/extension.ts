import * as vscode from 'vscode';
import * as MarkdownIt from 'markdown-it';
import { ShowPreviewCommand } from './showPreviewCommand';

export function activate(context: vscode.ExtensionContext) {
    const md = new MarkdownIt({
        html: false,
        breaks: true,
        linkify: true,
    });

    new ShowPreviewCommand(context, md);
}

// This method is called when your extension is deactivated
export function deactivate() { }
