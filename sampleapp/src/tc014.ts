// testcase: log|25-47

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/**
 * Console logger `implementation`. {@link LogLevel}. @see LogLevel
 */
export class ConsoleLogger {
    /**
     * Log message into console logger.
     * @param level - level of logging message
     * @param message - content of log message
     * @param error - optional error (in case of logging catched exception)
     */
    public log(level: LogLevel, message: string, error: Error): void {
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