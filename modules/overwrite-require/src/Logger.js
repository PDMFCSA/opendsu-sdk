const envTypes = require("./moduleConstants");
const originalConsole = Object.assign({}, console);
const IS_DEV_MODE = process.env.DEV === "true" || typeof process.env.DEV === "undefined";
const errorTypes = require("./errorTypes");
if (typeof process.env.OPENDSU_ENABLE_DEBUG === "undefined") {
    process.env.OPENDSU_ENABLE_DEBUG = IS_DEV_MODE.toString();
}
const DEBUG_LOG_ENABLED = process.env.OPENDSU_ENABLE_DEBUG === "true";
if ($$.environmentType === envTypes.NODEJS_ENVIRONMENT_TYPE) {
    const logger = new Logger("Logger", "overwrite-require");
    if (DEBUG_LOG_ENABLED) {
        logger.log = logger.debug;
    } else {
        logger.log = () => {
        }
    }
    Object.assign(console, logger);
} else {
    $$.memoryLogger = new MemoryFileMock();
    const logger = new Logger("Logger", "overwrite-require", $$.memoryLogger);
    Object.assign(console, logger);
}

function MemoryFileMock() {
    let arr = [];
    this.append = (logLine) => {
        arr.push(logLine);
    }
    this.dump = () => {
        return JSON.stringify(arr);
    }
}


function Logger(className, moduleName, logFile) {
    const MAX_STRING_LENGTH = 11;
    const verbosityLevels = {
        "trace": 0,
        "debug": 1,
        "info": 2,
        "log": 3,
        "warn": 3,
        "error": 4,
        "critical": 5,
        "audit": 6
    }

    let verbosity;


    const getPaddingForArg = (arg, maxLen = MAX_STRING_LENGTH) => {
        let noSpaces = Math.abs(maxLen - arg.length);
        let spaces = String(" ").repeat(noSpaces);
        return spaces;
    };

    const convertIntToHexString = (number) => {
        let hexString = number.toString("16");
        if (hexString.length === 1) {
            hexString = "0" + hexString;
        }
        return "0x" + hexString;
    }

    const normalizeArg = (arg) => {
        if (arg.length >= MAX_STRING_LENGTH) {
            return arg.substring(0, MAX_STRING_LENGTH);
        } else {
            return `${arg}${getPaddingForArg(arg)}`;
        }
    }

    const getLogMessage = (data) => {
        let msg = '';
        try {
            if (typeof data === "object") {
                if (data instanceof Error) {
                    msg = `${data.message}\n${data.stack}`;
                } else if (data.debug_stack || data.debug_message) {
                    msg = data.toString();
                } else {
                    msg = JSON.stringify(data) + " ";
                }
            } else {
                msg = data + " ";
            }
        } catch (e) {
            msg = e.message + " ";
        }
        return msg;
    }

    const createLogObject = (functionName, code = 0, ...args) => {
        let message = "";
        for (let i = 0; i < args.length; i++) {
            message += getLogMessage(args[i]);
        }

        message = message.trimEnd();
        const logObject = {
            severity: functionName.toUpperCase(),
            timestamp: new Date().toISOString(),
            eventTypeId: convertIntToHexString(code),
            component: moduleName,
            className: className,
            message
        }
        return logObject;
    }

    const getLogStringFromObject = (logObject, appendEOL = false) => {
        let logString;
        if (IS_DEV_MODE) {
            logObject.message = logObject.message.replaceAll("\n", "\n\t");
            logString = `${logObject.severity}${getPaddingForArg(logObject.severity, 9)}${logObject.eventTypeId}${getPaddingForArg(logObject.eventTypeId, 3)} ${logObject.timestamp}`;

            if (typeof logObject.component !== "undefined") {
                logString = `${logString} ${normalizeArg(logObject.component)}`;
            }
            if (typeof logObject.className !== "undefined") {
                logString = `${logString} ${normalizeArg(logObject.className)}`;
            }

            logString = `${logString} ${logObject.message}`;

            if (appendEOL) {
                logString += require("os").EOL;
            }
        } else {
            logObject.message = logObject.message.replaceAll("\n", "\\n");
            logObject.message = logObject.message.replaceAll("\r", "\\r");
            logString = JSON.stringify(logObject);
        }
        return logString;
    }

    const getLogAsString = (functionName, appendEOL = false, ...args) => {
        const res = stripCodeFromArgs(...args);
        let logObject = createLogObject(functionName, res.code, ...res.args);
        let logString = getLogStringFromObject(logObject, appendEOL);
        return logString;
    }

    const stripCodeFromArgs = (...args) => {
        let code = args[0];
        if (typeof code !== "number" || args.length === 1) {
            code = 0;
        } else {
            args.shift();
        }

        return {
            code,
            args
        }
    }

    const functions = errorTypes;
    const getConsoleFunction = (functionName) => {
        if (functionName === functions.CRITICAL) {
            functionName = functions.ERROR;
        }

        if (functionName === functions.AUDIT) {
            functionName = functions.LOG;
        }

        return functionName;
    }

    const executeFunctionFromConsole = (functionName, ...args) => {
        if (typeof $$.debug !== "undefined" && typeof $$.debug.getVerbosityLevel === "function") {
            verbosity = verbosityLevels[$$.debug.getVerbosityLevel()];
        } else {
            verbosity = verbosityLevels["trace"];
        }

        if (verbosity > verbosityLevels[functionName]) {
            return;
        }
        if ($$.memoryLogger) {
            originalConsole[getConsoleFunction(functionName)](...args);
        } else {
            const log = getLogAsString(functionName, false, ...args);
            originalConsole[getConsoleFunction(functionName)](log);
        }
    }

    const writeToFile = (functionName, ...args) => {
        const fs = require("fs");
        const path = require("path");
        if (typeof logFile === "undefined") {
            return;
        }

        let log = getLogAsString(functionName, true, ...args);
        if (logFile instanceof MemoryFileMock) {
            logFile.append(log);
            return;
        }
        try {
            fs.accessSync(path.dirname(logFile));
        } catch (e) {
            fs.mkdirSync(path.dirname(logFile), {recursive: true});
        }

        fs.appendFileSync(logFile, log);
    }

    const printToConsoleAndFile = (functionName, ...args) => {
        executeFunctionFromConsole(functionName, ...args);
        writeToFile(functionName, ...args);
    }

    for (let fnName in functions) {
        this[functions[fnName]] = (...args) => {
            printToConsoleAndFile(functions[fnName], ...args);
        }
    }
    //adding alias for warn fnc
    this.warning = this.warn;

    if (!DEBUG_LOG_ENABLED) {
        this[functions.TRACE] = this[functions.DEBUG] = () => {
        };
    }

    const originalWarn = this.warn;
    const originalError = this.error;
    const originalTrace = this.trace;

    if ($$.debug && typeof $$.debug.errorWithCodeShouldBeRedirectedToStdout === "function") {
        const __generateFunction = (functionName) => {
            return (...args) => {
                const res = stripCodeFromArgs(...args);
                if ($$.debug.errorWithCodeShouldBeRedirectedToStdout(res.code)) {
                    executeFunctionFromConsole(functions.DEBUG, ...args);
                    $$.debug.useStderrForErrorWithCode(res.code);
                    this.warn = originalWarn;
                    this.error = originalError;
                    this.trace = originalTrace;
                    console.error = this.error;
                    console.warn = this.warn;
                    console.trace = this.trace;
                } else {
                    printToConsoleAndFile(functionName, ...args);
                }
            }
        }
        this.error = __generateFunction(functions.ERROR);
        this.warn = __generateFunction(functions.WARN);
        this.trace = __generateFunction(functions.TRACE);

        console.error = this.error;
        console.warn = this.warn;
        console.trace = this.trace;
    }
}

const getLogger = (className, moduleName, criticalLogFile) => {
    return new Logger(className, moduleName, criticalLogFile);
}

module.exports = {
    getLogger
}
