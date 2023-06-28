import * as vscode from 'vscode';
import { init, isTypescriptFile } from './shared';
import { previewPanel } from './preview';

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

    context.subscriptions.push(
        vscode.commands.registerCommand(
            'typedocPreview.showPreview',
            function (uri: vscode.Uri) {
                return showPreview(uri || vscode.window.activeTextEditor?.document.uri, vscode.ViewColumn.Active);
            }),

        vscode.commands.registerTextEditorCommand(
            'typedocPreview.showPreviewToSide',
            textEditor => showPreview(textEditor.document.uri, vscode.ViewColumn.Beside))
    );

    //new ShowPreviewCommand(context, md);
}

// This method is called when your extension is deactivated
export function deactivate() { }
