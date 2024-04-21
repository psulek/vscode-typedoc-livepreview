import * as path from 'path';
import * as process from 'process';
import * as fse from 'fs-extra';
import { convertTypeDocToMarkdown } from '../converter';
import { ExtensionConfig } from '../types';

(async () => {
    const config: ExtensionConfig = { hideEmptySignatures: true };

    const cwd = process.cwd();

    const file = path.join(cwd, 'test-data/src/', 'tc018.mtsx');
    //const content = await fse.readFile(file);
    const result = await convertTypeDocToMarkdown(file, file, 0, 'content', config);
    console.log(result);
})();