import * as path from 'path';
import * as ts from 'typescript';
import { Application, DeclarationReflection, PageEvent, Reflection, RenderTemplate, LogLevel, ReflectionKind } from 'typedoc';
import { arraySortBy } from './utils';

export type PreviewUpdateMode = 'content' | 'cursor';

type DeclarationReflectionInfo = {
    startline: number;
    endline: number;
    model: DeclarationReflection;
    originModel?: DeclarationReflection;
    template: RenderTemplate<PageEvent<Reflection>>;
};

const lastConversion = {
    originFilename: '',
    editorLine: 0,
    markdown: '',
    app: undefined as unknown as Application,
    reflections: [] as DeclarationReflectionInfo[]
};

const validKindForChildren = [ReflectionKind.Project, ReflectionKind.Module, ReflectionKind.Namespace, ReflectionKind.Class, ReflectionKind.Interface];

export async function convertTypeDocToMarkdown(sourceFile: string, originFilename: string,
    editorLine: number, updateMode: PreviewUpdateMode): Promise<string> {
    let markdown = '';
    const compile = updateMode === 'content' || lastConversion.originFilename !== originFilename || lastConversion.reflections.length === 0;

    if (compile) {
        lastConversion.editorLine = editorLine;
        lastConversion.originFilename = originFilename;

        const app = new Application();
        lastConversion.app = app;

        const opts = {
            entryPoints: [sourceFile],
            plugin: ['typedoc-plugin-markdown'],
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

        app.options.setCompilerOptions([sourceFile], {
            target: 7, //ScriptTarget.ES2020,
            module: 6, // ModuleKind.ES2020,
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
        }, undefined);

        const project = app.convert()!;
        const renderer = app.renderer;
        (renderer as any).prepareTheme();
        const theme = renderer.theme!;
        const urls = theme.getUrls(project);

        const projectSourceFile = app.getEntryPoints()![0].sourceFile!;
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

        const findConstructor = (ref: Reflection): DeclarationReflection | undefined => {
            if (ref.parent && ref.parent.kind === ReflectionKind.Class && ref.parent instanceof DeclarationReflection
                && ref.parent.children && ref.parent.children.length > 0) {
                return ref.parent.children.find(x => x.kind === ReflectionKind.Constructor);
            }

            return undefined;
        };

        lastConversion.reflections.length = 0;
        urls.forEach(mapping => {
            if (mapping.model instanceof Reflection) {
                const template = mapping.template;

                // value - line number of constructor
                const constructors = new Map<DeclarationReflection, number>();

                const recurseChildren = (model: Reflection, originModel?: DeclarationReflection): void => {
                    if (model instanceof DeclarationReflection && model.sources && model.sources.length > 0) {
                        const symbol = project.getSymbolFromReflection(model)!;
                        const modelSources = model.sources[0];
                        const modelSourcesFileName = path.resolve(modelSources.fullFileName);
                        if (modelSourcesFileName === sourceFile) {
                            let valueDeclaration = symbol.valueDeclaration! as any;
                            if (valueDeclaration === undefined && symbol.declarations && symbol.declarations.length > 0) {
                                valueDeclaration = symbol.declarations[0];
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

                            let allowAdd = true;

                            // when property, check if startline is same as startline of constructor of same class, 
                            // and if so, it means this property was created from constructor 'public' modifier
                            if (model.kind === ReflectionKind.Property) {
                                const parentCtor = findConstructor(model);
                                if (parentCtor && constructors.has(parentCtor)) {
                                    const propertyDeclareLine = modelSources.line;
                                    if (constructors.get(parentCtor) === propertyDeclareLine) {
                                        //startline = endline = propertyDeclareLine;
                                        allowAdd = false;
                                    }
                                }
                            } else if (model.kind === ReflectionKind.Constructor) {
                                constructors.set(model, bodyStartLine);
                            }

                            if (allowAdd) {
                                lastConversion.reflections.push({ startline, endline, model, template, originModel });
                            }

                            const modelIsTypeLiteral = model.kind === ReflectionKind.TypeLiteral;
                            if (model.children && model.children.length > 0 &&
                                (validKindForChildren.includes(model.kind) ||
                                    (modelIsTypeLiteral && model.children?.some(x => x.kind === ReflectionKind.Property)))
                            ) {
                                model.children.forEach(child => { recurseChildren(child); });
                            }
                        }
                    }
                };

                let modelToInspect = mapping.model;
                let originModel: DeclarationReflection | undefined = undefined;
                if (mapping.model instanceof DeclarationReflection &&
                    mapping.model.type?.type === 'reflection' &&
                    mapping.model.type?.declaration instanceof DeclarationReflection
                    //&& mapping.model.type.declaration.children?.some(x => x.kind === ReflectionKind.Property)
                ) {
                    modelToInspect = mapping.model.type?.declaration;
                    originModel = mapping.model;
                }

                recurseChildren(modelToInspect, originModel);
                // recurseChildren(mapping.model);
            }
        });

        lastConversion.reflections = arraySortBy(lastConversion.reflections, x => x.startline, 'asc');
    }

    if (editorLine === 0) {
        return ''; // load into cache, without conversion to md
    }

    let reflection: DeclarationReflectionInfo | undefined = editorLine === 1 ? lastConversion.reflections.find(x => x.startline >= editorLine) : undefined;
    if (reflection === undefined && editorLine > 1) {
        for (let i = 0; i < lastConversion.reflections.length; i++) {
            const item = lastConversion.reflections[i];
            if (editorLine === item.startline) {
                reflection = item;
                break;
            }

            if (editorLine >= item.startline && editorLine <= item.endline) {
                reflection = item;
                break;
            }
        }
    }

    if (reflection) {
        //let model = reflection.originModel ?? reflection.model;
        let model = reflection.model;
        let comment = model.comment;
        let signatures = model.signatures;

        if ((comment === undefined && (signatures === undefined || signatures.length === 0)) && reflection.originModel) {
            model = reflection.originModel!;
            comment = model.comment;
            signatures = model.signatures;
        }

        if ((comment === undefined && (signatures === undefined || signatures.length === 0)) &&
            model.type &&
            model.type?.type === 'reflection' &&
            model.type?.declaration instanceof DeclarationReflection) {
            model = model.type.declaration;
            comment = model.comment;
            signatures = model.signatures;
        }

        const page = new PageEvent(PageEvent.BEGIN, model);
        page.project = model.project;

        const renderer = lastConversion.app.renderer;
        const theme = renderer.theme!;
        renderer.trigger(PageEvent.BEGIN, page);

        let mdString = '';
        if (comment || (signatures && signatures.length > 0)) {
            const context = (theme as any).getRenderContext(page);
            const md: string[] = [];

            let pageTitle = '';

            // @ts-ignore
            //if (model.sources && model.sources.length > 0) {
            if (model.kind !== ReflectionKind.TypeLiteral) {
                pageTitle = context.memberTitle(page.model, true);
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

            if (signatures) {
                signatures.forEach((signature) => {
                    md.push(context.signatureMember(signature, headingLevel));
                });
            }
            else if (comment) {
                // if (reflection instanceof typedoc_1.ReferenceReflection) {
                //     md.push(context.referenceMember(reflection));
                // }

                if (model instanceof DeclarationReflection) {
                    //md.push(context.declarationMember(reflection, headingLevel + 1));
                    md.push(context.comment(comment, headingLevel));
                }
            }

            mdString = md.join('\n\n').trimEnd();
            markdown = mdString;
        }

        //page.contents = theme.render(page, reflection.template);
        //markdown = (page.contents ?? '').trim() ?? '';
        if (markdown.length > 0) {
            const idx = markdown.lastIndexOf('## Source');
            if (idx > -1) {
                markdown = markdown.substring(0, idx);
            }
        }

        markdown = markdown.trimEnd();
    } else {
        //markdown = lastConversion.markdown;
    }

    lastConversion.markdown = markdown;
    return markdown;
}