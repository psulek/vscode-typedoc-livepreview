import * as vscode from 'vscode';
import * as path from 'path';
import { EmptySignaturesTypes, ExtensionConfig, ILogger, TsLibCacheManifest, TsLibCacheManifestFile } from './types';
import * as ts from 'typescript';
import * as tsvfs from '@typescript/vfs';
import fetch from 'node-fetch';
import prettyBytes from 'pretty-bytes';
import { pathExist, pathStats, promiseEachSeries } from './utils';

export type VsCodeTheme = 'light' | 'dark';
export const webViewPanelType = 'typedocPreview';
const supportedExtensions = ['.ts', '.mts', '.tsx', '.mtsx'];

const configKeys = {
    emptySignatures: 'typedoclivepreview.emptySignatures'
};

export class Context {
    private ctx!: vscode.ExtensionContext;
    private _tsLibraryFiles: string[] = [];
    private contextInitialized = false;
    private activeTheme: VsCodeTheme = 'light';
    private reloadingLibs = false;
    private logger!: ILogger;

    init(ctx: vscode.ExtensionContext, logger?: ILogger): void {
        this.ctx = ctx;
        this.logger = logger ?? new VsCodeLogger();
        this.setTheme(vscode.window.activeColorTheme.kind);

        (async () => {
            try {
                await this.downloadTypescriptLibs();
            } finally {
                this.contextInitialized = true;
            }
        })();
    }

    get tsLibraryFiles(): string[] {
        return this._tsLibraryFiles;
    }

    get vsContext(): vscode.ExtensionContext {
        return this.ctx;
    }

    get contextIsInitialized(): boolean {
        return this.contextInitialized;
    }

    async refreshTsLibCache(): Promise<void> {
        if (!this.reloadingLibs) {
            this.reloadingLibs = true;
            try {
                this.logger.log('info', `Refreshing typescript library types cache...`);
                await this.downloadTypescriptLibs(true);
            } catch (error) {
                this.logger.log('error', `Refresh typescript library types cache failed.`, error as Error);
            } finally {
                this.reloadingLibs = false;
            }
        }
    }

    private async downloadTypescriptLibs(force?: boolean): Promise<void> {
        try {
            force = force ?? false;
            const tsVersion = ts.version;
            const tsLibsPath = 'tslibs/';
            const tsLibsPathUri = this.getUri(tsLibsPath);

            const deleteLibsFolder = async (): Promise<void> => {
                if (await pathExist(tsLibsPathUri.fsPath)) {
                    await vscode.workspace.fs.delete(tsLibsPathUri, { recursive: true, useTrash: false });
                }
            };

            if (force) {
                await deleteLibsFolder();
            }

            const manifestFileUri = this.getUri(`${tsLibsPath}manifest.json`);
            const knownLibFiles = tsvfs.knownLibFilesForCompilerOptions({ target: 1 }, ts);

            let download = true;
            if ((await pathExist(manifestFileUri.fsPath))) {
                this._tsLibraryFiles.length = 0;
                try {
                    const manifestFile = Buffer.from(await vscode.workspace.fs.readFile(manifestFileUri)).toString('utf8');
                    if (manifestFile && manifestFile.length > 0) {
                        const manifestFileJson: TsLibCacheManifest = JSON.parse(manifestFile);

                        let libFilesValid = false;
                        if (manifestFileJson.tsVersion === tsVersion && manifestFileJson.files?.length === knownLibFiles.length) {
                            await promiseEachSeries(knownLibFiles, async libFile => {
                                const libPath = this.getUri(`${tsLibsPath}${libFile}`).fsPath;
                                const stats = await pathExist(libPath) ? await pathStats(libPath) : undefined;
                                const manifestFile = manifestFileJson.files.find(x => x.name === libFile);

                                const manifestSize = manifestFile?.size ?? -1;
                                libFilesValid = stats !== undefined && stats.size > 0 && stats.size === manifestSize;
                                if (libFilesValid) {
                                    this._tsLibraryFiles.push(libPath);
                                }
                                return libFilesValid;
                            });
                        }

                        download = !libFilesValid;
                        if (download) {
                            this.logger.log('info', `Found invalid typescript lib cache entry, refreshing entire cache...`);
                        }
                    }
                } catch (error) {
                    this.logger.log('error', `Failed to load/parse '${manifestFileUri.fsPath}' file!`, error as Error);
                }
            } else {
                this.logger.log('info', `Could not find typescript lib cache manifest, refreshing entire cache...`);
            }

            if (download) {
                await deleteLibsFolder();

                const prefix = `https://typescript.azureedge.net/cdn/${tsVersion}/typescript/lib/`;
                this.logger.log('info', `Downloading basic typescript libs (CDN: ${prefix}) into extension folder`);

                this._tsLibraryFiles.length = 0;

                const libs = (await Promise.all(knownLibFiles.map(lib => fetch(prefix + lib).then(resp => {
                    return resp.status === 200 ? resp.text() : undefined;
                }))));
                let valid = 0;

                let bytes = 0;
                const files: TsLibCacheManifestFile[] = [];
                await promiseEachSeries(libs, async (text, index) => {
                    if (text) {
                        const name = knownLibFiles[index];
                        const fileUri = this.getUri(tsLibsPath + name);
                        this._tsLibraryFiles.push(fileUri.fsPath);
                        await vscode.workspace.fs.writeFile(fileUri, Buffer.from(text, 'utf8'));
                        const size = (await vscode.workspace.fs.stat(fileUri)).size;
                        bytes += size;
                        files.push({ name, size });
                        valid++;
                    }
                });

                if (libs.length === valid) {
                    const versionFileContent: TsLibCacheManifest = {
                        tsVersion,
                        files: files
                    };
                    await vscode.workspace.fs.writeFile(manifestFileUri, Buffer.from(JSON.stringify(versionFileContent, null, 2), 'utf8'));

                    this.logger.log('info', `Successfully downloaded ${files.length} typescript libs (${prettyBytes(bytes)}).`);
                } else {
                    this.logger.log('warn', `Downloaded only ${valid} out of ${libs.length} required typescript libs.`);
                }
            } else {
                this.logger.log('info', `Found local cache of typescript libs at path: ` + tsLibsPathUri.fsPath);
            }
        } catch (error) {
            this.logger.log('error', 'Failed to download typescript libs from CDN.', error as Error);
        }
    }

    waitForInit(): Promise<void> {
        return this.contextInitialized ? Promise.resolve() : new Promise(resolve => {
            const end = Date.now() + (10 * 1000);
            let ref: NodeJS.Timer | undefined = setInterval(() => {
                if (ref && (this.contextInitialized || (Date.now() >= end))) {
                    clearInterval(ref);
                    ref = undefined;
                    resolve();
                }
            }, 10);
        });
    }

    setTheme(vsThemeKind: vscode.ColorThemeKind): void {
        this.activeTheme = vsThemeKind === vscode.ColorThemeKind.Dark ? 'dark' : 'light';
    }

    getUri = (relativePath: string): vscode.Uri =>
        vscode.Uri.joinPath(this.ctx.extensionUri, relativePath);

    getMediaUri = (webview: vscode.Webview, filename: string, themed: boolean): vscode.Uri => {
        const diskPath = themed
            ? vscode.Uri.joinPath(this.ctx.extensionUri, 'media', this.activeTheme, filename)
            : vscode.Uri.joinPath(this.ctx.extensionUri, 'media', filename);
        return webview.asWebviewUri(diskPath);
    };

    getConfig(): ExtensionConfig {
        const cfg = vscode.workspace.getConfiguration();
        const emptySignatures = cfg.get(configKeys.emptySignatures) as string;
        return {
            hideEmptySignatures: emptySignatures === EmptySignaturesTypes.hide
        };
    }

    async updateConfig(newConfig: ExtensionConfig) {
        const emptySignatures = newConfig.hideEmptySignatures ? EmptySignaturesTypes.hide : EmptySignaturesTypes.show;
        await vscode.workspace.getConfiguration().update(configKeys.emptySignatures, emptySignatures, vscode.ConfigurationTarget.Global);
    }
}

let vsCodeLoggerPanel: vscode.OutputChannel | undefined;

export class VsCodeLogger implements ILogger {
    log(level: 'info' | 'warn' | 'error', msg: string, err?: Error | undefined): void {
        if (!vsCodeLoggerPanel) {
            vsCodeLoggerPanel = vscode.window.createOutputChannel('TypeDoc Live Preview');
        }

        vsCodeLoggerPanel.appendLine(`[${level}] ${msg}` + (err ? `[${err.name}] ${err.message} ${err.stack}` : ''));
    }
}

//export const vsCodeLogger = new VsCodeLogger();

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

export const context = new Context();