/* eslint-disable @typescript-eslint/naming-convention */
import * as path from 'path';
import * as process from 'process';
import * as fse from 'fs-extra';
import * as chalk from 'chalk';
import * as normalize from 'crlf-normalize';
import { convertTypeDocToMarkdown } from './converter';
import { arraySortBy, promiseEachSeries, readFileLinesUntil } from './utils';
import { ExtensionConfig } from './types';
import { findFiles } from './converter.spec.utils';

const fileHeader = `// testcase:`;
const log = console.log;

type TestCaseLineInfo = {
    id: string;
    start: number;
    end: number;
};

async function main() {
    const colorError = chalk.redBright;

    try {
        const cwd = process.cwd();
        const dirTestCases = path.join(cwd, '../sampleapp/src/');
        const dirMarkdowns = path.join(cwd, '../sampleapp/mds/');

        const filterTests = '';
        // const filterTests = 'tc010.ts';
        //const filterTests = 'tc014.ts';
        // const filterTests = 'tc002.ts';

        const colorNumber = chalk.blueBright;
        const colorFile = chalk.cyan;
        const colorWarn = chalk.yellow;
        const colorSuccess = chalk.green;

        const testCases = arraySortBy(await findFiles('*.ts', { cwd: dirTestCases }), x => x, 'asc');
        const totalCount = testCases.length;
        log('Found ' + colorNumber(totalCount) + ' test cases: (' + colorFile(testCases.join(', ')) + ')\n');

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

        const config: ExtensionConfig = { hideEmptySignatures: true };

        await promiseEachSeries(testCases, async (testCase, idx) => {
            if (filterTests && filterTests !== testCase) {
                return;
            }

            const file = path.resolve(dirTestCases, testCase);
            log(`\n[${++idx}/${totalCount}] Processing test case '${colorFile(file)}'`);

            const lines = (await readFileLinesUntil(file, _ => 'accept')).filter(x => x.startsWith(fileHeader));

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

                        await convertTypeDocToMarkdown(file, file, 0, 'content', config);
                        const baseFileName = path.parse(testCase).name;

                        await promiseEachSeries(fileLines.values(), async test => {
                            const line_start = test.start;
                            const md = await convertTypeDocToMarkdown(file, file, line_start, 'cursor', config);

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
                                const md = await convertTypeDocToMarkdown(file, file, line, 'cursor', config);
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
    } catch (error) {
        log(colorError(error));
    }
}

main();