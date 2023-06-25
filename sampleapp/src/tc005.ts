export type PromiseType = () => Promise<void>;

/**
 * Date format types.
 * 
 * @export
 * @enum {number}
 */
export type DateFormat = 'date' | 'time' | 'dateTime' | 'iso' | 'fileTimestamp';

export type PromiseMapper<Element = unknown, NewElement = unknown> = (
    element: Element,
    index: number
) => NewElement | Promise<NewElement>;

export interface PromiseMapOptions {
    /**
    Number of concurrently pending promises returned by `mapper`.

    Must be an integer from 1 and up or `Infinity`.

    @default Infinity
    */
    readonly concurrency?: number;

    /**
    When set to `false`, instead of stopping when a promise rejects, it will wait for all the promises to settle and then reject with an [aggregated error](https://github.com/sindresorhus/aggregate-error) containing all the errors from the rejected promises.

    @default true
    */
    readonly stopOnError?: boolean;
}

export interface PromiseRetryOptions {
    interval?: number,
    max_tries?: number,
    predicate?: () => boolean;
}

/**
 * Levels for logging.
 * 
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface IDummy {}

export type LogMessageFunction = (message: string, error?: Error) => void;

/**
 * Core logger interface
 */
export type ILogger = {
    /**
     * Flag whenever hosting environment is in debug build (true) or not (false).
     */
    readonly DEBUG: boolean;

    /**
     * Readonly data dictionary associated with logger.
     */
    readonly data: Record<string, string>;

    /**
     * Logs message and/or error at specified log level.
     */
    log: (level: NonNullable<LogLevel>, message: string, error?: Error) => void;

    logDebug: LogMessageFunction;

    logInfo: LogMessageFunction;

    logWarn: LogMessageFunction;

    logError: LogMessageFunction;
};

export type ExpireMapItem<V> = {
    timeout: number;
    expireTime: number;
    value: V;
}

export type ExpireMapItemExpireAction = 'remove' | 'update';
export type ExpireMapItemExpiredCallbackResult<V> = Partial<Omit<ExpireMapItem<V>, 'expireTime'>> & { expireAction?: ExpireMapItemExpireAction };
export type ExpireMapItemExpiredCallback<V> = (item: ExpireMapItem<V>) => ExpireMapItemExpiredCallbackResult<V>;

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface TEnumConstructor<TEnum> extends Object {
}

// export type NumericRange<T extends number> = number extends T ? number : _Range<T, []>;
// type _Range<T extends number, R extends unknown[]> = R['length'] extends T ? R[number] : _Range<T, [R['length'], ...R]>;
