// _testcase: class|8-11
// _testcase: ctor|12-18
// _testcase: dataProp|20-23
// testcase: log|25-47

//import { ILogger, LogLevel } from './tc005';

/**
 * Console logger `implementation`. {@link LogLevel}. @see LogLevel
 */
export class ConsoleLogger implements ILogger {
    /**
     * Creates instance of {@link ConsoleLogger} class.
     * @param DEBUG - debug flag whenever to log debug messages or not.
     */
    constructor(public DEBUG: boolean) {
        this.data = {};
    }

    /**
     * Custom data dictionary.
     */
    public data: Record<string, string>;

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

    public logDebug(message: string, error?: Error | undefined): void {
        console.log(message, error);
    }

    public logInfo(message: string, error?: Error | undefined): void {
        console.log(message, error);
    }

    public logWarn(message: string, error?: Error | undefined): void {
        console.warn(message, error);
    }

    public logError(message: string, error?: Error | undefined): void {
        console.error(message, error);
    }
}
