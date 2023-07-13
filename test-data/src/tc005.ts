// testcase: PromiseType|11-14
// testcase: DateFormat|16-20
// testcase: LogLevel|22-26
// testcase: LogMessageFunction|28-33
// testcase: ILogger|35-38
// testcase: ILogger_DEBUG|39-42
// testcase: ILogger_data|44-47
// testcase: ILogger_log|49-52
// testcase: TEnumCtor|63-66

/**
 * Promise like type alias.
 */
export type PromiseType = () => Promise<void>;

/**
 * Date format types.
 * 
 */
export type DateFormat = 'date' | 'time' | 'dateTime' | 'iso' | 'fileTimestamp';

/**
 * Levels for logging.
 * 
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/**
 * Log's message function type.
 * @param message - message string to log
 * @param error - optional error object associated with log
 */
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

/**
 * interface marker for enums.
 */
export interface TEnumConstructor<TEnum> extends Object {
}