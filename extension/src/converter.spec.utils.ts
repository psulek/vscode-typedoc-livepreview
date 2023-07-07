const glob = require('glob-all');
import type { IOptions as globOptions } from 'glob';

export function findFiles(globPattern: string | string[], options?: globOptions & { dotRelative?: boolean }): Promise<string[]> {
    return new Promise<string[]>((resolve, reject) => glob(globPattern, options, (err: Error, result: string[]) => err ? reject(err) : resolve(result)));
}
