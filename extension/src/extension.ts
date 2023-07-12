import * as vscode from 'vscode';
import { configKeys, contextIsInitialized, downloadTypescriptLibs, initContext, isTypescriptFile, setTheme, updateConfig, waitForContext } from './shared';
import { previewPanel } from './previewCommand';

export function activate(context: vscode.ExtensionContext) {
    initContext(context);

    async function showPreview(column: vscode.ViewColumn, textEditor?: vscode.TextEditor, uri?: vscode.Uri) {
        const isValidFile = (uri && isTypescriptFile(uri)) || (textEditor && isTypescriptFile(textEditor.document));
        if (!isValidFile) {
            return;
        }

        if (!contextIsInitialized()) {
            await waitForContext();
        }

        previewPanel.show({
            viewColumn: column,
            fsPath: uri && uri.fsPath,
            textEditor: textEditor
        });
    };

    setTheme(vscode.window.activeColorTheme.kind);

    context.subscriptions.push(
        vscode.commands.registerCommand(
            'typedocPreview.showPreview',
            (uri: vscode.Uri) => showPreview(vscode.ViewColumn.Active, vscode.window.activeTextEditor, uri)
        ),

        vscode.commands.registerCommand(
            'typedocPreview.showEmptySignatures',
            () => updateConfig({ hideEmptySignatures: false })
        ),

        vscode.commands.registerCommand(
            'typedocPreview.hideEmptySignatures',
            () => updateConfig({ hideEmptySignatures: true })
        ),

        vscode.commands.registerTextEditorCommand(
            'typedocPreview.showPreviewToSide',
            textEditor => showPreview(vscode.ViewColumn.Beside, textEditor)),

        vscode.commands.registerTextEditorCommand(
            'typedocPreview.reloadPreview',
            _ => previewPanel.reload()),

        vscode.workspace.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration(configKeys.emptySignatures)) {
                //previewPanel.refresh();
            }
        })
    );
}

// This method is called when your extension is deactivated
export function deactivate() { }
