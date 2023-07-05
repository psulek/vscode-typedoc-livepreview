import * as fs from 'fs';
import * as events from 'events';
import * as readline from 'readline';
const debounce = require('lodash.debounce');
import type { IOptions as globOptions } from 'glob';
const glob = require('glob-all');

class Deferred<T> {
    promise;
    resolve?: (value: T | PromiseLike<T>) => void = undefined;
    reject?: (reason?: any) => void = undefined;

    constructor() {
        this.promise = new Promise<T>((resolve, reject) => {
            this.resolve = resolve;
            this.reject = reject;
        });
        Object.freeze(this);
    }
}

export async function delay(ms: number): Promise<void> {
    return new Promise<void>(resolve => setTimeout(resolve, ms));
}

export function findFiles(globPattern: string | string[], options?: globOptions & { dotRelative?: boolean }): Promise<string[]> {
    return new Promise<string[]>((resolve, reject) => glob(globPattern, options, (err: Error, result: string[]) => err ? reject(err) : resolve(result)));
}

export async function readFileLinesUntil(file: string, predicate: (line: string) => 'accept' | 'stop'): Promise<string[]> {
    const result: string[] = [];

    const fileStream = fs.createReadStream(file, {
        flags: 'r',
        encoding: 'utf8',
        fd: undefined,
        mode: 0o666,
        autoClose: true
    });
    const rl = readline.createInterface({
        input: fileStream
    });

    let stopping = false;

    rl.on('line', (line: string) => {
        if (!stopping) {
            const res = predicate(line);
            if (res === 'accept') {
                result.push(line);
            } else if (res === 'stop') {
                stopping = true;
                rl.close();
                fileStream.destroy();
            }
        }
    });

    await events.once(rl, 'close');
    return result;
}

// export async function readFileLines(file: string, lines: number): Promise<string[]> {
//     const result: string[] = [];

//     const fileStream = fs.createReadStream(file, {
//         flags: 'r',
//         encoding: 'utf8',
//         fd: undefined,
//         mode: 0o666,
//         autoClose: true
//     });
//     const rl = readline.createInterface({
//         input: fileStream
//     });

//     rl.on('line', (line: string) => {
//         if (result.length < lines) {
//             result.push(line);
//             if (result.length === lines) {
//                 rl.close();
//                 fileStream.destroy();
//             }
//         }
//     });

//     await events.once(rl, 'close');
//     return result;
// }


export function arraySortBy<T, U>(source: T[], predicate: (item: T) => U, sortOrder: 'asc' | 'desc' = 'asc'): T[] {
    return source.concat([]).sort((a, b) => {
        const v1 = predicate(a);
        const v2 = predicate(b);
        const res = v1 > v2 ? 1 : ((v2 > v1) ? -1 : 0);
        return sortOrder === 'asc' ? res : res * -1;
    });
}
export async function promiseEachSeries<ValueType>(
    input: Iterable<PromiseLike<ValueType> | ValueType>,
    iterator: (element: ValueType, index: number) => unknown | boolean
): Promise<void> {

    let index = 0;
    for (const value of input) {
        // eslint-disable-next-line no-await-in-loop
        const res = await iterator(await value, index++);
        if (typeof res === 'boolean') {
            if (!res) {
                break;
            }
        }
    }
}

export function asyncDebounce(func: (...args: unknown[]) => Promise<any>, wait: number, options: any): Promise<any> {
    const deferredSet: Deferred<any>[] = [];

    const debounceFunc = debounce(async (...args: any) => {
        const result = await func(...args);
        deferredSet.forEach(deferred => {
            deferred.resolve!(result);
        });
        deferredSet.splice(0, deferredSet.length);
    }, wait, options);

    // @ts-ignore
    return (...args) => {
        const deferred = new Deferred();
        deferredSet.push(deferred);
        debounceFunc(...args);
        return deferred.promise;
    };
};

// export const debounce = (func: Function, ms: number): Function => {
//     let timeout: NodeJS.Timeout | null;

//     return function wrapper(this: Function, ...args: any[]) {
//         const context = this;

//         var later = () => {
//             timeout = null;
//             func.apply(context, args);
//         };

//         if (timeout) {
//             clearTimeout(timeout);
//         }
//         timeout = setTimeout(later, ms);
//     };
// };

// export const throttle = (func: Function, ms: number): Function => {

//     let isThrottled = false;
//     let savedArgs: any[] | null;
//     let savedThis: Function | null;

//     function wrapper(this: Function, ...args: any[]) {

//         if (isThrottled) {
//             savedArgs = args;
//             savedThis = this;
//             return;
//         }

//         func.apply(this, args);

//         isThrottled = true;

//         setTimeout(function () {
//             isThrottled = false;
//             if (savedArgs && savedThis) {
//                 wrapper.apply(savedThis, [...savedArgs]);
//                 savedArgs = savedThis = null;
//             }
//         }, ms);
//     }

//     return wrapper;
// };
