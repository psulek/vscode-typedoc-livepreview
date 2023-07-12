import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs/promises';
import { EmptySignaturesTypes, ExtensionConfig, ILogger } from './types';
import * as ts from 'typescript';
import * as tsvfs from '@typescript/vfs';
import fetch from 'node-fetch';
import { pathExist, pathStats, promiseEachSeries } from './utils';

export type VsCodeTheme = 'light' | 'dark';

export const webViewPanelType = 'typedocPreview';

export let context: vscode.ExtensionContext;
let activeTheme: VsCodeTheme = 'light';

const supportedExtensions = ['.ts', '.mts', '.tsx', '.mtsx'];

export class VsCodeLogger implements ILogger {
    panel: vscode.OutputChannel | undefined;

    log(level: 'info' | 'warn' | 'error', msg: string, err?: Error | undefined): void {
        if (!this.panel) {
            this.panel = vscode.window.createOutputChannel('TypeDocLivePreview');
        }

        this.panel.appendLine(`[${level}] ${msg}` + (err ? `[${err.name}] ${err.message} ${err.stack}` : ''));
    }
}

export const vsCodeLogger = new VsCodeLogger();

export const tsLibraryFiles: string[] = [];

let contextInitialized = false;

export const contextIsInitialized = (): boolean => contextInitialized;

export function waitForContext(): Promise<void> {
    return new Promise(resolve => {
        const end = Date.now() + (10 * 1000);
        let ref: NodeJS.Timer | undefined = setInterval(() => {
            if (ref && (contextInitialized || (Date.now() >= end))) {
                clearInterval(ref);
                ref = undefined;
                resolve();
            }
        }, 10);
    });
}

export function initContext(ctx: vscode.ExtensionContext): void {
    context = ctx;

    (async () => {
        try {
            await downloadTypescriptLibs();
        } finally {
            contextInitialized = true;
        }
    })();
}

export async function downloadTypescriptLibs(): Promise<void> {
    try {
        const tsVersion = ts.version;
        const tsLibsPath = 'tslibs/';
        const versionFileUri = getUri(`${tsLibsPath}version.txt`);
        const knownLibFiles = tsvfs.knownLibFilesForCompilerOptions({ target: 1 }, ts);

        let download = true;
        if ((await pathExist(versionFileUri.fsPath))) {
            tsLibraryFiles.length = 0;
            try {
                const versionFile = Buffer.from(await vscode.workspace.fs.readFile(versionFileUri)).toString('utf8');
                if (versionFile && versionFile.length > 0) {
                    const versionFileJson = JSON.parse(versionFile);
                    if (versionFileJson.tsVersion === tsVersion) {
                        let libFilesValid = false;
                        await promiseEachSeries(knownLibFiles, async libFile => {
                            const libPath = getUri(`${tsLibsPath}${libFile}`).fsPath;
                            const stats = await pathStats(libPath);
                            libFilesValid = stats !== undefined && stats.size > 0;
                            if (libFilesValid) {
                                tsLibraryFiles.push(libPath);
                            }
                            return libFilesValid;
                        });

                        download = !libFilesValid;
                    }
                }
            } catch (error) {
                vsCodeLogger.log('error', `Failed to load/parse '${versionFileUri.fsPath}' file!`, error as Error);
            }
        }

        if (download) {
            const prefix = `https://typescript.azureedge.net/cdn/${tsVersion}/typescript/lib/`;
            vsCodeLogger.log('info', `Downloading basic typescript libs (CDN: ${prefix}) into extension folder`);

            tsLibraryFiles.length = 0;

            const libs = (await Promise.all(knownLibFiles.map(lib => fetch(prefix + lib).then(resp => resp.status === 200 ? resp.text() : undefined))));
            let valid = 0;
            await promiseEachSeries(libs, async (text, index) => {
                if (text) {
                    const fileUri = getUri(tsLibsPath + knownLibFiles[index]);
                    tsLibraryFiles.push(fileUri.fsPath);
                    await vscode.workspace.fs.writeFile(fileUri, Buffer.from(text, 'utf8'));
                    valid++;
                }
            });

            if (libs.length === valid) {
                const versionFileContent = { tsVersion };
                await vscode.workspace.fs.writeFile(versionFileUri, Buffer.from(JSON.stringify(versionFileContent, null, 2), 'utf8'));

                vsCodeLogger.log('info', `Successfully downloaded basic typescript libs`);
            } else {
                vsCodeLogger.log('warn', `Downloaded only ${valid} out of ${libs.length} required typescript libs`);
            }
        } else {
            vsCodeLogger.log('info', `Found local cache of typescript libs at path: ` + getUri(tsLibsPath).fsPath);
        }
    } catch (error) {
        vsCodeLogger.log('error', 'Failed to download typescript libs from CDN', error as Error);
    }
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