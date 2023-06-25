/* eslint-disable @typescript-eslint/naming-convention */
import * as path from 'path';
import * as process from 'process';
import * as fse from 'fs-extra';
//const chalk = require('chalk');
import * as chalk from 'chalk';
import { convertTypeDocToMarkdown } from './typedoc';
import { arraySortBy, fidFiles, promiseEachSeries, readFileLinesUntil } from './utils';

const fileHeader = `// testcase:`;
const log = console.log;

const sym_bullet = '•';

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
        //const getEditorLine = (line: number): number => --line;

        // const filterTests = 'tc001.ts';
        const filterTests = 'tc002.ts';

        //const file = path.join(samplesSrc, 'single.ts');
        // load all into cache
        //const md = await convertTypeDocToMarkdown(file, file, 4, 'content');

        //console.log(chalk.blue(md));
        const colorNumber = chalk.blueBright;
        const colorFile = chalk.cyan;
        const colorWarn = chalk.yellow;
        const colorSuccess = chalk.green;

        const testCases = arraySortBy(await fidFiles('*.ts', { cwd: dirTestCases }), x => x, 'asc');
        const totalCount = testCases.length;
        //console.log(testCases);
        log('Found ' + colorNumber(totalCount) + ' test cases: (' + colorFile(testCases.join(', ')) + ')\n');

        await promiseEachSeries(testCases, async (testCase, idx) => {
            if (!filterTests.includes(testCase)) {
                return;
            }

            log(`Processing test case '${colorFile(testCase)}' (${++idx}/${totalCount})`);

            const file = path.join(dirTestCases, testCase);
            const lines = await readFileLinesUntil(file, x => x.startsWith(fileHeader) ? 'accept' : 'stop');
            if (lines.length > 0) {
                const fileLines = new Map<string, TestCaseLineInfo>();

                await promiseEachSeries(lines, async line => {
                    const linesToTestStr = line.substring(fileHeader.length).trim();
                    const linesToTest = linesToTestStr.split('|');
                    if (linesToTest.length === 2) {
                        //log('\tfound lines to test: ' + colorNumber(linesToTest));

                        //const fileLines: Array<Array<number>> = [];
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
                        log(`\nFile '${colorFile(file)}' -> found ` + colorNumber(fileLines.size) + ' line headers for tests!');

                        // load all into cache
                        const md_firstLine = await convertTypeDocToMarkdown(file, file, 1, 'content');
                        const baseFileName = path.parse(testCase).name;

                        promiseEachSeries(fileLines.values(), async test => {
                            const line_start = test.start;
                            const md_start = line_start === 1 ? md_firstLine : await convertTypeDocToMarkdown(file, file, line_start, 'cursor');

                            const expectedFileBase = `${baseFileName}.${test.id}.md`;
                            const expectedFile = path.join(dirMarkdowns, expectedFileBase);
                            const expectedFileExist = await fse.pathExists(expectedFile);
                            const expectedFileContent = expectedFileExist ? await fse.readFile(expectedFile, { encoding: 'utf-8' }) : undefined;

                            if (!expectedFileExist) {
                                log(`\t• expected file ` + colorFile(expectedFileBase) + ' not exist, creating new...');
                                await fse.writeFile(expectedFile, md_start, { encoding: 'utf-8' });
                            } else {
                                log(`\t• found expected file ` + colorFile(expectedFileBase));
                                if (md_start === expectedFileContent) {
                                    log(`\t• test case '${test.id}' - conversion validity ` + colorSuccess('passed'));
                                } else {
                                    //log('\t• ' + colorError(`conversion '${test.id}' (${test.start}-${test.end}) does not match expected value!`));
                                    const verifiedFileBase = `${baseFileName}.${test.id}-verified.md`;
                                    log(`\t• test case '${test.id}' - conversion validity ` + colorError('failed') + `, expected file '` +
                                        colorFile(expectedFileBase) + `' does not match file '` + colorFile(verifiedFileBase) + `'`);

                                    const verifiedFile = path.join(dirMarkdowns, verifiedFileBase);
                                    await fse.writeFile(verifiedFile, md_start, { encoding: 'utf-8' });
                                }
                            }

                            let endLine = test.end;
                            let successLines = 0;
                            let failedLines: number[] = [];
                            for (let line = line_start; line <= endLine; line++) {
                                const md = await convertTypeDocToMarkdown(file, file, line, 'cursor');
                                if (md === md_start) {
                                    successLines++;
                                } else {
                                    failedLines.push(line);
                                }
                            }

                            log(`\t• test case '${test.id}' - ` + colorSuccess(successLines) + ' test(s) ' + colorSuccess(`passed`));
                            if (failedLines.length > 0) {
                                log(`\t• test case '${test.id}' - ` + colorError(failedLines.length) + ' test(s) ' + colorError(`failed`) + ` on lines: ${failedLines.join(', ')}`);
                            }
                        });

                    } catch (error) {
                        log(colorError(`Error converting file '${file}' typedoc comments into markdown.`));
                    }
                } else {
                    log(colorWarn(`File '${file}' does not contains any valid lines to test!`));
                }
            } else {
                log(colorWarn(`File '${file}' is not valid test case file, missing header '${fileHeader}' lines.\n`));
            }
        });

        // const testLines = [[1, 4], [5, 11], [14, 15]];

        // promiseEachSeries(testLines, async test => {
        //     const line_start = test[0];
        //     const md_start = await convertTypeDocToMarkdown(file, file, line_start, 'cursor');

        //     let endLine = test[1];
        //     for (let line = line_start; line <= endLine; line++) {
        //         const md = await convertTypeDocToMarkdown(file, file, line, 'cursor');
        //         if (md !== md_start) {
        //             console.error(`lines: ${JSON.stringify(test)} -> markdown conversion failed on line: ${line}, its not same as on line: ${line_start}\n\n${md}!`);
        //         }

        //         console.info('all good for lines: ', test);
        //     }
        // });
    } catch (error) {
        log(colorError(error));
    }
}

main();