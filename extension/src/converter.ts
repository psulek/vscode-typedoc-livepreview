import * as path from 'path';
import * as ts from 'typescript';
import {
    Application, DeclarationReflection, PageEvent, Reflection, LogLevel, ReflectionKind,
    ContainerReflection, Comment, SignatureReflection, ProjectReflection, DocumentationEntryPoint
} from 'typedoc';
import { arraySortBy } from './utils';
import { ConsoleLogger, ExtensionConfig } from './types';

// eslint-disable-next-line @typescript-eslint/naming-convention
const { BasePath } = require('typedoc');
const pluginMarkdown = require('typedoc-plugin-markdown');

export type PreviewUpdateMode = 'content' | 'cursor';

type DeclarationReflectionInfo = {
    startline: number;
    endline: number;
    model: DeclarationReflection;
    comment?: Comment;
    signature?: SignatureReflection;
};

type MarkdownInfo = {
    startline: number;
    endline: number;
    markdown: string;
};

type ConversionCache = {
    originFilename: string,
    editorLine: number,
    markdowns: MarkdownInfo[],
    app: Application,
    reflections: DeclarationReflectionInfo[]
};

const debugs: string[] = [];

let lastConversion: ConversionCache;
resetCache();

const validKindForChildren = [ReflectionKind.Project, ReflectionKind.Module, ReflectionKind.Namespace, ReflectionKind.Class, ReflectionKind.Interface];

export function getLastConvertedFile(): string {
    return lastConversion.originFilename;
}

export function resetCache(): void {
    lastConversion = {
        originFilename: '',
        editorLine: 0,
        markdowns: [] as MarkdownInfo[],
        app: undefined as unknown as Application,
        reflections: [] as DeclarationReflectionInfo[]
    };
    debugs.length = 0;
}

const tscOptions = {
    // target: ts.ScriptTarget.ESNext,
    // module: ts.ModuleKind.ESNext,

    target: ts.ScriptTarget.ES5,

    //module: ts.ModuleKind.,

    //noLib: true,
    //lib: ['ES2020', 'DOM', 'WebWorker', 'ScriptHost'],

    declaration: false,
    declarationMap: false,
    strict: true,
    noEmitOnError: true,
    removeComments: true,
    sourceMap: true,
    suppressImplicitAnyIndexErrors: true,
    allowSyntheticDefaultImports: true,
    forceConsistentCasingInFileNames: true,
    esModuleInterop: true,
    skipLibCheck: true,
    noImplicitAny: true,
    noUnusedLocals: false,
    noUnusedParameters: false,
    preserveConstEnums: true
};

let convertCounter = 0;
const consoleLogger = new ConsoleLogger();

export const isDifferentFile = (originFilename: string) => lastConversion.originFilename !== originFilename;

export async function convertTypeDocToMarkdown(sourceFile: string, originFilename: string,
    editorLine: number, mode: PreviewUpdateMode, config: ExtensionConfig): Promise<string> {

    const logger = config.logger ?? consoleLogger;
    let markdown = '';
    const dateNow = Date.now();
    const logging = config.logging ?? false;
    const cnt = (++convertCounter).toString().padStart(4, '0');
    const log = (msg: string) => logging && console.log(`[typedoc.preview_${cnt}] ${msg}`);

    const differentFile = isDifferentFile(originFilename);
    if (differentFile) {
        log(`resetting cache`);
        resetCache();
    }

    const compile = mode === 'content' || differentFile || lastConversion.reflections.length === 0;
    const hideEmptySignatures = config.hideEmptySignatures;

    const compiledReflections: DeclarationReflectionInfo[] = [];

    if (compile) {
        try {
            debugs.length = 0;
            log(`compiling file: ${originFilename}`);

            const normalizedSourceFile = BasePath.normalize(sourceFile);

            lastConversion.editorLine = editorLine;
            lastConversion.originFilename = originFilename;

            const app = new Application();
            lastConversion.app = app;

            const opts = {
                entryPoints: [sourceFile],
                plugin: ['typedoc-plugin-markdown'],
                // eslint-disable-next-line @typescript-eslint/naming-convention
                pluginInstanes: { 'typedoc-plugin-markdown': pluginMarkdown },
                skipErrorChecking: true,
                hideGenerator: true,
                readme: 'none',
                includeVersion: false,
                hidePageHeader: true,
                hideInPageTOC: true,
                hidePageTitle: false,
                excludeGroups: true,
                hideKindPrefix: false,
                hideBreadcrumbs: true,
                hideHierarchy: true,
                identifiersAsCodeBlocks: true,
                logLevel: LogLevel.None
            };
            await app.bootstrapWithPlugins(opts);

            app.options.setCompilerOptions([sourceFile], tscOptions, undefined);

            const { project, entryPoints } = app.convert() as unknown as { project: ProjectReflection, entryPoints: DocumentationEntryPoint[] };
            const renderer = app.renderer;
            (renderer as any).prepareTheme();

            //const projectSourceFile = app.getEntryPoints()![0].sourceFile!;
            const projectSourceFile = entryPoints[0].sourceFile!;
            const projectSourceFileName = path.resolve(projectSourceFile.fileName);
            if (projectSourceFileName !== sourceFile) {
                throw new Error(`Source file '${sourceFile}' does not match project file '${projectSourceFileName}'!`);
            }

            const getSourceLine = (pos: number): number => {
                return ts.getLineAndCharacterOfPosition(projectSourceFile, pos).line + 1;
            };

            const findParentJsDoc = (ref: Reflection, modelSourceLine: number): any => {
                let parent = ref.parent as any;
                while (parent) {
                    if (parent.jsDoc !== undefined) {
                        break;
                    }

                    parent = parent.parent;
                }

                let jsDoc = parent && parent.jsDoc && parent.jsDoc.length > 0 && parent.jsDoc[0].pos > 0 ? parent.jsDoc[0] : undefined;
                if (jsDoc) {
                    if ((getSourceLine(jsDoc.end) + 1) !== modelSourceLine) {
                        jsDoc = undefined;
                    }
                }

                return jsDoc;
            };

            const findSourceFileName = (reflection: SignatureReflection): string => {
                return reflection.sources && Array.isArray(reflection.sources) && reflection.sources.length > 0 ? reflection.sources[0].fullFileName : '';
            };

            const isSourceFileValid = (reflection: SignatureReflection): boolean => findSourceFileName(reflection) === normalizedSourceFile;

            const findParentSignature = (reflection: Reflection): (SignatureReflection | undefined) => {
                let parent = reflection.parent as any;
                while (parent) {
                    if (parent instanceof SignatureReflection) {
                        break;
                    }

                    parent = parent.parent;
                }

                return parent instanceof SignatureReflection ? parent : undefined;
            };

            const findConstructor = (ref: Reflection): DeclarationReflection | undefined => {
                if (ref.parent && ref.parent.kind === ReflectionKind.Class && ref.parent instanceof DeclarationReflection
                    && ref.parent.children && ref.parent.children.length > 0) {
                    return ref.parent.children.find(x => x.kind === ReflectionKind.Constructor);
                }

                return undefined;
            };

            lastConversion.reflections.length = 0;

            // value - line number of constructor
            const constructors = new Map<DeclarationReflection, number>();

            const recurseChildren = (parent: ContainerReflection): void => {
                if (parent.children) {
                    parent.children.forEach(model => {
                        if (!(model instanceof DeclarationReflection && model.sources && model.sources.length > 0 && model.inheritedFrom === undefined)) {
                            return;
                        }

                        const symbol = project.getSymbolFromReflection(model)!;
                        const modelKind = ReflectionKind.singularString(model.kind);
                        let modelSources = model.sources[0];
                        //let modelSources = model.sources.find(x => x.fullFileName === normalizedSourceFile)!;
                        const modelSourcesFileName = modelSources.fullFileName;

                        if (modelSourcesFileName !== normalizedSourceFile) {
                            return;
                        }

                        let valueDeclaration = symbol.valueDeclaration! as any;
                        if (valueDeclaration === undefined && symbol.declarations && symbol.declarations.length > 0) {
                            valueDeclaration = symbol.declarations[0];
                        }

                        // if model is interface, we need to get correct declaration in case there is interface & declare var for same name
                        // like it is for 'interface EventTarget' and 'declare var EventTarget'
                        //if (model.kind === ReflectionKind.Interface && symbol.declarations) {
                        if (symbol.declarations && symbol.declarations.length > 1 && model.sources && model.sources.length > 1) {
                            //const sss = ts.SyntaxKind[ts.SyntaxKind.InterfaceDeclaration];
                            //valueDeclaration = symbol.declarations.find(x => x.kind === ts.SyntaxKind.InterfaceDeclaration);

                            const symbDeclaration = symbol.declarations.find(x => ts.SyntaxKind[x.kind].indexOf(modelKind) > -1);
                            if (symbDeclaration) {
                                valueDeclaration = symbDeclaration;
                                const line = getSourceLine((symbDeclaration as any).name.pos);
                                const ms = model.sources.find(x => x.fullFileName === normalizedSourceFile && x.line === line);
                                if (ms) {
                                    modelSources = ms;
                                }
                            }
                        }


                        let jsDoc = valueDeclaration.jsDoc && valueDeclaration.jsDoc.length > 0 ? valueDeclaration.jsDoc[0] : undefined;
                        if (jsDoc === undefined) {
                            jsDoc = findParentJsDoc(valueDeclaration, modelSources.line);
                        }

                        const body = valueDeclaration.body;

                        let startline = jsDoc ? getSourceLine(jsDoc.pos) : modelSources.line;
                        let endline = modelSources.line;

                        let bodyStartLine = 0;
                        if (body) {
                            const startPos = jsDoc ? jsDoc.pos : body.pos;
                            startline = getSourceLine(startPos);
                            endline = getSourceLine(body.end);
                            bodyStartLine = getSourceLine(body.pos);
                        }

                        const declarationEndLine = getSourceLine(valueDeclaration.end);
                        if ([ReflectionKind.TypeAlias].includes(model.kind) && declarationEndLine > endline &&
                            model.type?.type !== 'reflection') {
                            endline = declarationEndLine;
                        }

                        if (valueDeclaration.typeParameters && valueDeclaration.typeParameters.length > 0 &&
                            model.type?.type !== 'reflection') {
                            valueDeclaration.typeParameters.forEach((tp: any) => {
                                const line = tp.end ? getSourceLine(tp.end) : 0;
                                if (line > endline) {
                                    endline = line;
                                }
                            });
                        }

                        let allowAdd = true;

                        // when property, check if startline is same as startline of constructor of same class, 
                        // and if so, it means this property was created from constructor 'public' modifier
                        if (model.kind === ReflectionKind.Property) {
                            const parentCtor = findConstructor(model);
                            if (parentCtor && constructors.has(parentCtor)) {
                                const propertyDeclareLine = modelSources.line;
                                if (constructors.get(parentCtor) === propertyDeclareLine) {
                                    allowAdd = false;
                                }
                            }
                        } else if (model.kind === ReflectionKind.Constructor) {
                            constructors.set(model, bodyStartLine);
                        }

                        if (allowAdd) {
                            let comment = model.comment;
                            let signatures = model.signatures;

                            if ((comment === undefined && (signatures === undefined || signatures.length === 0)) &&
                                model.type &&
                                model.type?.type === 'reflection' &&
                                model.type?.declaration instanceof DeclarationReflection) {
                                comment = model.type.declaration.comment;
                                signatures = model.type.declaration.signatures;
                            }

                            if (comment && comment.isEmpty() && hideEmptySignatures) {
                                comment = undefined;
                            }

                            if (signatures && signatures.length > 0) {
                                const validSignature = signatures.some(sig => {
                                    if (sig.comment && !sig.comment.isEmpty()) {
                                        return true;
                                    }

                                    if (sig.parameters && sig.parameters.length > 0) {
                                        return sig.parameters.some(p => p.comment && !p.comment.isEmpty());
                                    }
                                });

                                if (!validSignature && hideEmptySignatures) {
                                    signatures = undefined;
                                }
                            }

                            if (comment || (signatures && signatures.length > 0)) {
                                const name = valueDeclaration?.name?.escapedText;
                                if (name && name.length > 0) {
                                    model.name = name;
                                }

                                if (signatures && signatures.length > 0) {
                                    signatures.forEach(sig => {

                                        const childRefs = (project as any).getReflectionChildsByParentId(sig.id);
                                        if (childRefs && Array.isArray(childRefs) && childRefs.length > 0) {
                                            const childSymbol = (project as any).getSymbolByReflectionId(childRefs[0]);
                                            if (childSymbol) {
                                                const childRef = project.getReflectionFromSymbol(childSymbol);
                                                if (childRef) {
                                                    const childParent = findParentSignature(childRef);
                                                    if (childParent) {
                                                        if (isSourceFileValid(childParent) && childSymbol.valueDeclaration && childSymbol.valueDeclaration.parent) {
                                                            const jsDoc = (childSymbol.valueDeclaration.parent as any).jsDoc;
                                                            if (jsDoc && Array.isArray(jsDoc) && jsDoc.length > 0) {
                                                                startline = getSourceLine(jsDoc[0].pos);
                                                            }
                                                        }
                                                    }
                                                }
                                            }
                                        }

                                        let signatureFileIsValid = true;
                                        if (sig.sources && sig.sources.length > 0) {
                                            signatureFileIsValid = isSourceFileValid(sig);
                                            if (sig.sources[0].line > endline) {
                                                endline = sig.sources[0].line;
                                            }
                                        }

                                        if (signatureFileIsValid) {
                                            const dbg = `${startline}-${endline}`;
                                            if (!debugs.includes(dbg)) {
                                                debugs.push(dbg);
                                                compiledReflections.push({ startline, endline, model, comment, signature: sig });
                                            }
                                        }
                                    });
                                } else {
                                    const dbg = `${startline}-${endline}`;
                                    if (!debugs.includes(dbg)) {
                                        debugs.push(dbg);
                                        compiledReflections.push({ startline, endline, model, comment, signature: undefined });
                                    }
                                }
                            }
                        }

                        let modelToIterate = model;
                        let iterateChilds = model.children && model.children.length > 0 && validKindForChildren.includes(model.kind);
                        // if ([ReflectionKind.TypeAlias].includes(model.kind) &&
                        if (model instanceof DeclarationReflection &&
                            model.type?.type === 'reflection' &&
                            model.type?.declaration instanceof DeclarationReflection &&
                            model.type.declaration.children &&
                            model.type.declaration.children.length > 0
                        ) {
                            iterateChilds = true;
                            modelToIterate = model.type.declaration;
                        }

                        if (iterateChilds) {
                            recurseChildren(modelToIterate);
                        }
                    });
                }
            };

            recurseChildren(project);
        } catch (error) {
            logger.log('error', `Error compiling '${originFilename}' into typedoc structures`, error as Error);
        }

        //log(`compiling file: ${originFilename} completed with ${compiledReflections.length} reflections in ` + calcDuration(dateNow, Date.now()));
    }

    if (compiledReflections.length > 0) {
        lastConversion.reflections.push(...compiledReflections);
        lastConversion.reflections = arraySortBy(lastConversion.reflections, x => x.startline, 'asc');
    }

    // load into cache, without conversion to md
    if (editorLine === 0) {
        return '';
    }

    let useCache = mode === 'cursor' && editorLine > 0 && lastConversion.originFilename === originFilename &&
        lastConversion.markdowns && lastConversion.markdowns.length > 0;

    if (useCache) {
        const cache = lastConversion.markdowns.find(x => editorLine >= x.startline && editorLine <= x.endline);
        if (cache) {
            markdown = cache.markdown ?? '';
        } else {
            useCache = false;
        }
    } else {
        lastConversion.markdowns = [];
    }

    if (!useCache) {
        let lineReflection: DeclarationReflectionInfo | undefined = undefined;
        if (editorLine > 0) {
            for (let i = 0; i < lastConversion.reflections.length; i++) {
                const item = lastConversion.reflections[i];
                if (editorLine === item.startline) {
                    lineReflection = item;
                    break;
                }

                if (editorLine >= item.startline && editorLine <= item.endline) {
                    lineReflection = item;
                    break;
                }
            }
        }

        const renderReflection = (reflection: DeclarationReflectionInfo): string => {
            let result = '';
            try {
                let model = reflection.model;
                let comment = reflection.comment;
                let signature = reflection.signature;

                const page = new PageEvent(PageEvent.BEGIN, model);
                page.project = model.project;

                const renderer = lastConversion.app.renderer;
                const theme = renderer.theme!;
                renderer.trigger(PageEvent.BEGIN, page);

                let mdString = '';
                if (comment || signature) {
                    const context = (theme as any).getRenderContext(page);
                    let md: string[] = [];

                    let pageTitle = model.hasOwnDocument || model.kind === ReflectionKind.Constructor ? '' : `${ReflectionKind.singularString(model.kind)}: `;

                    // @ts-ignore
                    if (model.kind !== ReflectionKind.TypeLiteral) {
                        pageTitle += context.memberTitle(page.model, true);
                    }
                    // @ts-ignore
                    else if (model.parent && model.parent.sources && model.parent.sources.length > 0 &&
                        !validKindForChildren.includes(model.parent.kind)) {
                        pageTitle = context.memberTitle(model.parent, true);
                    }

                    let headingLevel = 1;
                    if (pageTitle && pageTitle.length > 0) {
                        md.push(`# ${pageTitle}`);
                        headingLevel++;
                    }

                    if (signature) {
                        md.push(context.signatureMember(signature, headingLevel));
                    } else if (comment) {
                        if (model instanceof DeclarationReflection) {
                            md.push(context.comment(comment, headingLevel));
                        }

                        if (model.typeParameters && model.typeParameters.length > 0) {
                            md.push(`## Type parameters`);
                            md.push(context.typeParametersTable(model.typeParameters));
                        }
                    }

                    mdString = md.join('\n\n').trimEnd();
                    result = mdString;
                }

                if (result.length > 0) {
                    const idx = result.lastIndexOf('## Source');
                    if (idx > -1) {
                        result = result.substring(0, idx);
                    }
                }

                result = result.trimEnd();
                if (result && result.length > 0) {
                    const cache = lastConversion.markdowns.find(x => x.startline === reflection.startline && x.endline === reflection.endline);
                    if (cache) {
                        cache.markdown = result;
                    } else {
                        lastConversion.markdowns.push({ markdown: result, startline: reflection.startline, endline: reflection.endline });
                    }
                }
            } catch (error) {
                logger.log('error', `Error rendering typedoc structures into markdown (file: '${originFilename}')`, error as Error);
            }

            return result;
        };

        let foundRef = false;
        for (let i = 0; i < compiledReflections.length; i++) {
            const reflection = compiledReflections[i];
            if (reflection === lineReflection) {
                foundRef = true;
                const md = renderReflection(reflection);
                markdown = md;
                break;
            }
        }


        if (!foundRef && lineReflection) {
            markdown = renderReflection(lineReflection);
        }
    }

    lastConversion.editorLine = editorLine;

    //log(`return markdown for '${originFilename}' in ` + calcDuration(dateNow, Date.now()));
    return markdown;
}