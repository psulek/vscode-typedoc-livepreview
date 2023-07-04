// testcase: copy1|9-17
// testcase: copy2|19-25
// testcase: copy3|27-34

type NoParamCallbackWithUndefined = (err: Error | null | undefined) => void;
type CopyOptions = {};


/**
 * Copy a file or directory. The directory can have contents.
 *
 * @param src - Note that if `src` is a directory it will copy everything inside of this directory,
 * not the entire directory itself (see [issue #537](https://github.com/jprichardson/node-fs-extra/issues/537)).
 * @param dest - Note that if `src` is a file, `dest` cannot be a directory
 * (see [issue #323](https://github.com/jprichardson/node-fs-extra/issues/323)).
 */
declare function copy(src: string, dest: string, options?: CopyOptions): Promise<void>;

/**
 * copy 2
 * @param src - param `src` 2
 * @param dest - param `dest` 2
 * @param callback - param `callback` 2
 */
declare function copy(src: string, dest: string, callback?: NoParamCallbackWithUndefined): void;

/**
 * copy 3
 * @param src - param `src` 3
 * @param dest - param `dest` 3
 * @param options - param `options` 3
 * @param callback - param `callback` 3
 */
declare function copy(src: string, dest: string, options: CopyOptions, callback: NoParamCallbackWithUndefined): void;
