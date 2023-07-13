// testcase: pathExists1|12-41
// testcase: pathExists2|42-42
// testcase: pathExistsSync|43-47

/// <reference types="node" />

import * as fs from 'fs';

export * from 'fs';


/**
 * Test whether or not the given path exists by checking with the file system. Like
 * [`fs.exists`](https://nodejs.org/api/fs.html#fs_fs_exists_path_callback), but with a normal
 * callback signature (err, exists). Uses `fs.access` under the hood.
 *
 * @example
 * import * as fs from 'fs-extra'
 *
 * const file = '/tmp/this/path/does/not/exist/file.txt'
 *
 * // With a callback:
 * fs.pathExists(file, (err, exists) => {
 *   console.log(err) // => null
 *   console.log(exists) // => false
 * })
 *
 * // Promise usage:
 * fs.pathExists(file)
 *   .then(exists => console.log(exists)) // => false
 *
 * // With async/await:
 * async function asyncAwait () {
 *   const exists = await fs.pathExists(file)
 *
 *   console.log(exists) // => false
 * }
 *
 * asyncAwait()
 */
export function pathExists(path: string): Promise<boolean>;
export function pathExists(path: string, callback: (err: NodeJS.ErrnoException | null, exists: boolean) => void): void;
/**
 * An alias for [`fs.existsSync`](https://nodejs.org/api/fs.html#fs_fs_existssync_path), created for
 * consistency with `pathExists`.
 */
export function pathExistsSync(path: string): boolean;

export const access: typeof fs.access.__promisify__ & typeof fs.access;
export const appendFile: typeof fs.appendFile.__promisify__ & typeof fs.appendFile;