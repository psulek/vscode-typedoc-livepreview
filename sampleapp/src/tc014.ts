// _testcase: class|8-11
// _testcase: ctor|12-18
// _testcase: dataProp|20-23
// testcase: log|12-34

//import { ILogger, LogLevel } from './tc005';

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