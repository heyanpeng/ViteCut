export declare enum LogLevel {
    VERBOSE = 0,
    LOG = 1,
    INFO = 2,
    WARN = 3,
    ERROR = 4,
    FATAL = 5,
    SILENT = Infinity
}
export declare const LogLevels: {
    VERBOSE: LogLevel;
    LOG: LogLevel;
    INFO: LogLevel;
    WARN: LogLevel;
    ERROR: LogLevel;
    SILENT: LogLevel;
};
export default class ConsoleLogger {
    static readonly instances: ConsoleLogger[];
    static level: LogLevel;
    static Levels: {
        VERBOSE: LogLevel;
        LOG: LogLevel;
        INFO: LogLevel;
        WARN: LogLevel;
        ERROR: LogLevel;
        SILENT: LogLevel;
    };
    static noColor: boolean;
    Levels: {
        VERBOSE: LogLevel;
        LOG: LogLevel;
        INFO: LogLevel;
        WARN: LogLevel;
        ERROR: LogLevel;
        SILENT: LogLevel;
    };
    level: LogLevel;
    prefix: string;
    enabled: boolean;
    debugColor: string;
    logColor: string;
    infoColor: string;
    warnColor: string;
    errorColor: string;
    fatalColor: string;
    /**
     * ConsoleLogger
     * @param   {string}  prefix  Logger prefix
     * @return  {ConsoleLogger}
     */
    constructor(prefix: string);
    static setLevel(level: LogLevel): void;
    static enable(level?: LogLevel): void;
    static disable(): void;
    /**
     * set logger prefix
     * @param prefix
     */
    setPrefix(prefix: string): void;
    /**
     * enable logger with optional log level
     * @param level
     */
    enable(level?: LogLevel): void;
    /**
     * disable logger
     */
    disable(): void;
    /**
     * Set log level
     * @param   {LogLevel}  level
     * @return  {void}
     */
    setLevel(level: LogLevel): void;
    /**
     * trace
     * @param title
     * @param args
     */
    trace(title: string, ...args: any[]): void;
    /**
     * debug
     * @param title
     * @param args
     */
    debug(title: string, ...args: any[]): void;
    /**
     * log
     * @param title
     * @param args
     */
    log(title: string, ...args: any[]): void;
    /**
     * info
     * @param title
     * @param args
     */
    info(title: string, ...args: any[]): void;
    /**
     * warn
     * @param title
     * @param args
     */
    warn(title: string, ...args: any[]): void;
    /**
     * error
     * @param title
     * @param args
     */
    error(title: string, ...args: any[]): void;
    /**
     * fatal error
     * @param title
     * @param args
     */
    fatal(title: string, ...args: any[]): void;
    /**
     * start a group with label
     * @param label
     */
    group(...label: any[]): void;
    /**
     * end a group
     */
    groupEnd(): void;
    /**
     * collapse log group
     * @param label
     */
    groupCollapsed(...label: any[]): void;
}
