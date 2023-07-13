// testcase: class|5-8
// testcase: log|9-31


/**
 * Console logger `implementation`. {@link LogLevel}. @see LogLevel
 */
export class ConsoleLogger implements ILogger {
    /**
     * Log message into console logger.
     * @param level - level of logging message
     * @param message - content of log message
     * @param error - optional error (in case of logging catched exception)
     */
    public log(level: LogLevel, message: string, error?: Error | undefined): void {
        switch (level) {
            case 'debug':
            case 'info': {
                console.log(message, error);
                break;
            }
            case 'warn': {
                console.warn(message, error);
                break;
            }
            case 'error': {
                console.error(message, error);
                break;
            }
        }
    }
}