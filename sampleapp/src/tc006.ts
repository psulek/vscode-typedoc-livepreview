// testcase: ILogger|5-8
// testcase: DEBUG|9-12
// testcase: log|14-20

/**
 * Core logger interface
 */
export type ILogger = {
    /**
     * Flag whenever hosting environment is in debug build (true) or not (false).
     */
    readonly DEBUG: boolean;

    /**
     * Logs message and/or error at specified log level.
     * @param level - log level
     * @param message - log message
     * @param error - log error (optional)
     */
    log: (level: string, message: string, error?: Error) => void;

    logDebug: () => void;
};