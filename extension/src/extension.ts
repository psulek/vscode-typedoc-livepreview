import * as vscode from 'vscode';
import { configKeys, init, isTypescriptFile, setTheme } from './shared';
import { previewPanel } from './previewCommand';

export function activate(context: vscode.ExtensionContext) {
    init(context);

    const showPreview = (uri: vscode.Uri, column: vscode.ViewColumn) => {
        if (!isTypescriptFile(uri)) {
            return;
        }

        previewPanel.show({
            viewColumn: column,
            fsPath: uri.fsPath,
        });
    };

    setTheme(vscode.window.activeColorTheme.kind);

    context.subscriptions.push(
        vscode.commands.registerCommand(
            'typedocPreview.showPreview',
            function (uri: vscode.Uri) {
                return showPreview(uri || vscode.window.activeTextEditor?.document.uri, vscode.ViewColumn.Active);
            }),

        vscode.commands.registerTextEditorCommand(
            'typedocPreview.showPreviewToSide',
            textEditor => showPreview(textEditor.document.uri, vscode.ViewColumn.Beside)),

        vscode.workspace.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration(configKeys.emptySignatures)) {
                //previewPanel.refresh();
            }
        })
    );

    //new ShowPreviewCommand(context, md);
}

// This method is called when your extension is deactivated
export function deactivate() { }
