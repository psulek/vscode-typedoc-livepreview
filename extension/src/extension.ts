import * as vscode from 'vscode';
import { configKeys, init, isTypescriptFile, setTheme, updateConfig } from './shared';
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
            (uri: vscode.Uri) => showPreview(uri || vscode.window.activeTextEditor?.document.uri, vscode.ViewColumn.Active)
        ),

        vscode.commands.registerCommand(
            'typedocPreview.showEmptySignatures',
            () => updateConfig({hideEmptySignatures: false})
        ),

        vscode.commands.registerCommand(
            'typedocPreview.hideEmptySignatures',
            () => updateConfig({hideEmptySignatures: true})
        ),

        vscode.commands.registerTextEditorCommand(
            'typedocPreview.showPreviewToSide',
            textEditor => showPreview(textEditor.document.uri, vscode.ViewColumn.Beside)),

        vscode.workspace.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration(configKeys.emptySignatures)) {
                //previewPanel.refresh();
            }
        })
    );
}

// This method is called when your extension is deactivated
export function deactivate() { }
