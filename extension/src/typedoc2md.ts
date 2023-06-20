import path = require('path');
import { Application, DeclarationReflection, PageEvent, Reflection, ReflectionKind } from 'typedoc';
import { ModuleKind, ScriptTarget } from 'typescript';

export async function typeDocToMarkdown(sourceFile: string, lineNumber: number): Promise<string> {
    const app = new Application();
    const opts = {
        entryPoints: [sourceFile],
        plugin: ['typedoc-plugin-markdown'],
        skipErrorChecking: true,
        hideGenerator: true,
        readme: 'none',
        includeVersion: false,
        hidePageHeader: true,
        hideInPageTOC: true,
        hidePageTitle: true,
        excludeGroups: true,
        hideKindPrefix: false,
        hideBreadcrumbs: true,
        hideHierarchy: true,
        identifiersAsCodeBlocks: true
    };
    await app.bootstrapWithPlugins(opts);

    app.options.setCompilerOptions([sourceFile], {
        target: ScriptTarget.ES2020,
        module: ModuleKind.ES2020,
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

    let result = '';
    sourceFile = path.resolve(sourceFile).toLowerCase();

    urls.forEach(mapping => {
        if (mapping.model instanceof Reflection) {
            const model = mapping.model;

            if (model instanceof DeclarationReflection && model.sources && model.sources.length > 0) {
                const fullFileName = path.resolve(model.sources[0].fullFileName).toLowerCase();
                if (fullFileName === sourceFile) {
                    const page = new PageEvent(PageEvent.BEGIN, mapping.model);
                    page.project = project;
                    page.url = mapping.url;
                    //page.filename = path.join(outdir, mapping.url);
                    page.filename = sourceFile;
                    if (page.model instanceof Reflection) {
                        renderer.trigger(PageEvent.BEGIN, page);
                        page.contents = theme.render(page, mapping.template);
                    }
        
                    result = page.contents ?? '';
                }
            }
        }
    });

    return result;
}