import * as assert from 'assert';
import * as vscode from 'vscode';

import * as path from 'path';
import * as process from 'process';
import * as fse from 'fs-extra';
import * as chalk from 'chalk';
import * as normalize from 'crlf-normalize';

import { converter, utils, types, getContext } from '../../extension';


// import { convertTypeDocToMarkdown } from '../../converter';
// import { arraySortBy, promiseEachSeries, readFileLinesUntil } from '../../utils';
// import { ExtensionConfig } from '../../types';
import type { IOptions as globOptions } from 'glob';

const glob = require('glob-all');
const log = console.log;

const fileHeader = `// testcase:`;

type TestCaseLineInfo = {
    id: string;
    start: number;
    end: number;
};

suite('Extension Test Suite', function() {
    // @ts-ignore
    this.timeout(0);
    this.slow(60000);

    let extensionContext: vscode.ExtensionContext;
    suiteSetup(async () => {
        const extId = 'psulek.typedoc-live-preview';
        const extension = vscode.extensions.getExtension(extId);
        assert.notEqual(extension, undefined, `Could not get extension '${extId}' !`);
        await extension!.activate();
        extensionContext = (global as any).testExtensionContext;
    });


    vscode.window.showInformationMessage('Start all tests.');

    test('Conversion tests', async () => {
        await runTests();
    });
});

async function runTests() {
    const colorError = chalk.redBright;

    try {
        const cwd = path.join(__dirname, 'test-data');
        const dirTestCases = path.join(cwd, 'src');
        const dirMarkdowns = path.join(cwd, 'mds');
        debugger;

        const ctx = getContext();
        //ctx.init(null!, new types.ConsoleLogger());
        await ctx.waitForInit();
        assert.equal(ctx.contextIsInitialized, true, 'extension context is not initialized!');

        const tsLibConfig: converter.TypescriptLibsConfig = {
            //root: workspaceRoot,
            libs: ctx.tsLibraryFiles
        };

        const filterTests = '';
        // const filterTests = 'tc010.ts';
        // const filterTests = 'tc014.ts';
        // const filterTests = 'tc002.ts';

        const colorNumber = chalk.blueBright;
        const colorFile = chalk.cyan;
        const colorWarn = chalk.yellow;
        const colorSuccess = chalk.green;

        const testCases = utils.arraySortBy(await findFiles('*.ts', { cwd: dirTestCases }), x => x, 'asc');
        const totalCount = testCases.length;
        log('Found ' + colorNumber(totalCount) + ' test cases: (' + colorFile(testCases.join(', ')) + ')\n');

        if (totalCount === 0) {
            assert.fail('Could not find any test data for conversion!');
        }

        const results = {
            conversion: {
                failed: 0,
                succeed: 0
            },

            lines: {
                failed: 0,
                succeed: 0
            }
        };

        const config: types.ExtensionConfig = { hideEmptySignatures: true };

        await utils.promiseEachSeries(testCases, async (testCase, idx) => {
            if (filterTests && filterTests !== testCase) {
                return;
            }

            const file = path.resolve(dirTestCases, testCase);
            log(`\n[${++idx}/${totalCount}] Processing test case '${colorFile(file)}'`);

            const lines = (await utils.readFileLinesUntil(file, _ => 'accept')).filter(x => x.startsWith(fileHeader));

            if (lines.length > 0) {
                const fileLines = new Map<string, TestCaseLineInfo>();

                lines.forEach(line => {
                    const linesToTestStr = line.substring(fileHeader.length).trim();
                    const linesToTest = linesToTestStr.split('|');
                    if (linesToTest.length === 2) {
                        const id = linesToTest[0].trim();
                        if (fileLines.has(id)) {
                            log(colorError(`Header id '${id}' (${line}) was already used. Use unique id on each test case header!`));
                        } else {
                            const lines = linesToTest[1].trim();
                            if (id === '' || lines === '') {
                                log(colorError(`Invalid lines header '${linesToTestStr}' in file '${file}'.`));
                            } else {
                                const lineNumbers = lines.split('-');
                                const start = Number(lineNumbers[0].trim());
                                const end = Number(lineNumbers[1].trim());
                                fileLines.set(id, { id, start, end });
                            }
                        }
                    }
                });

                if (fileLines.size > 0) {
                    try {
                        log(`\t• found ` + colorNumber(fileLines.size) + ' test case(s)');

                        await converter.convertTypeDocToMarkdown(file, file, 0, 'content', config, tsLibConfig);
                        const baseFileName = path.parse(testCase).name;

                        await utils.promiseEachSeries(fileLines.values(), async test => {
                            // eslint-disable-next-line @typescript-eslint/naming-convention
                            const line_start = test.start;
                            const md = await converter.convertTypeDocToMarkdown(file, file, line_start, 'cursor', config, tsLibConfig);

                            const expectedFileBase = path.join(baseFileName, `${test.id}.md`);
                            await fse.ensureDir(path.join(dirMarkdowns, baseFileName));

                            const expectedFile = path.join(dirMarkdowns, expectedFileBase);
                            const expectedFileExist = await fse.pathExists(expectedFile);
                            const expectedFileContent = expectedFileExist ? await fse.readFile(expectedFile, { encoding: 'utf8' }) : undefined;

                            if (!expectedFileExist) {
                                log(`\t• expected file ` + colorFile(expectedFileBase) + ' not exist, creating new...');
                                if (md.length === 0) {
                                    log(`\t• conversion to markdown is ` + colorError('empty') + ' !');
                                }
                                await fse.writeFile(expectedFile, md, { encoding: 'utf8' });
                            } else {
                                log(`\t• found expected file ` + colorFile(expectedFileBase));
                                let contentEquals = expectedFileContent === md;
                                if (!contentEquals && expectedFileContent !== undefined) {
                                    contentEquals = normalize.crlf(md, normalize.LF) === normalize.crlf(expectedFileContent, normalize.LF);
                                }

                                if (contentEquals) {
                                    results.conversion.succeed++;
                                    log(`\t• test case '${test.id}' - conversion validity ` + colorSuccess('passed'));
                                } else {
                                    results.conversion.failed++;
                                    const verifiedFileBase = path.join(baseFileName, `${test.id}-verified.md`);
                                    log(`\t• test case '${test.id}' - conversion validity ` + colorError('failed') + `, expected file '` +
                                        colorFile(expectedFileBase) + `' does not match file '` + colorFile(verifiedFileBase) + `'`);

                                    const verifiedFile = path.join(dirMarkdowns, verifiedFileBase);
                                    await fse.writeFile(verifiedFile, md, { encoding: 'utf8' });
                                }
                            }

                            let endLine = test.end;
                            let successLines = 0;
                            let failedLines: number[] = [];
                            for (let line = line_start; line <= endLine; line++) {
                                const md = await converter.convertTypeDocToMarkdown(file, file, line, 'cursor', config, tsLibConfig);
                                if (md === md) {
                                    successLines++;
                                    results.lines.succeed++;
                                } else {
                                    failedLines.push(line);
                                    results.lines.failed++;
                                }
                            }

                            log(`\t• test case '${test.id}' - ` + colorSuccess(successLines) + ' test(s) ' + colorSuccess(`passed`));
                            if (failedLines.length > 0) {
                                log(`\t• test case '${test.id}' - ` + colorError(failedLines.length) + ' test(s) ' + colorError(`failed`) + ` on lines: ${failedLines.join(', ')}`);
                            }
                        });

                    } catch (error) {
                        log(colorError(`Error converting file '${file}' typedoc comments into markdown.\n${(error as Error).message}`));
                        assert.fail(error as Error);
                    }
                } else {
                    log(colorWarn(`File '${file}' does not contains any valid lines to test!`));
                }
            } else {
                log(colorWarn(`File '${file}' is not valid test case file, missing header '${fileHeader}' lines.\n`));
            }
        });

        log(`\n`);
        if (results.conversion.failed > 0) {
            log(colorNumber(results.conversion.failed) + ` conversion tests ${colorError('failed')}.`);
        } else {
            log('All ' + colorNumber(results.conversion.succeed) + ` conversions tests ${colorSuccess('passed')}.`);
        }

        if (results.lines.failed > 0) {
            log(colorNumber(results.lines.failed) + ` conversion lines tests ${colorError('failed')}.`);
        } else {
            log('All ' + colorNumber(results.lines.succeed) + ` conversion lines tests ${colorSuccess('passed')}.`);
        }

        log(`\n`);

        if (results.conversion.failed > 0 || results.lines.failed > 0) {
            assert.fail(`${results.conversion.failed} conversion tests failed and ${results.lines.failed} conversion lines tests failed.`);
        }

    } catch (error) {
        log(colorError(error));
        assert.fail(error as Error);
    }
}

function findFiles(globPattern: string | string[], options?: globOptions & { dotRelative?: boolean }): Promise<string[]> {
    return new Promise<string[]>((resolve, reject) => glob(globPattern, options, (err: Error, result: string[]) => err ? reject(err) : resolve(result)));
}