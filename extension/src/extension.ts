import * as vscode from 'vscode';
import { isTypescriptFile, context } from './context';
import { previewPanel } from './command';

export function activate(ctx: vscode.ExtensionContext) {
    context.init(ctx);

    async function showPreview(column: vscode.ViewColumn, textEditor?: vscode.TextEditor, uri?: vscode.Uri) {
        const isValidFile = (uri && isTypescriptFile(uri)) || (textEditor && isTypescriptFile(textEditor.document));
        if (!isValidFile) {
            return;
        }

        await context.waitForInit();

        previewPanel.show({
            viewColumn: column,
            fsPath: uri && uri.fsPath,
            textEditor: textEditor
        });
    };

    ctx.subscriptions.push(
        vscode.commands.registerCommand(
            'typedocPreview.showPreview',
            (uri: vscode.Uri) => showPreview(vscode.ViewColumn.Active, vscode.window.activeTextEditor, uri)
        ),

        vscode.commands.registerCommand(
            'typedocPreview.showEmptySignatures',
            () => context.updateConfig({ hideEmptySignatures: false })
        ),

        vscode.commands.registerCommand(
            'typedocPreview.hideEmptySignatures',
            () => context.updateConfig({ hideEmptySignatures: true })
        ),

        vscode.commands.registerTextEditorCommand(
            'typedocPreview.showPreviewToSide',
            textEditor => showPreview(vscode.ViewColumn.Beside, textEditor)),

        vscode.commands.registerTextEditorCommand(
            'typedocPreview.reloadPreview',
            async _ => {
                await context.waitForInit();
                previewPanel.reload();
            }),
        
            vscode.commands.registerTextEditorCommand(
            'typedocPreview.refreshTsLibCache',
            async _ => {
                await context.refreshTsLibCache();
                previewPanel.reload();
            })
    );
}

// This method is called when your extension is deactivated
export function deactivate() { }
