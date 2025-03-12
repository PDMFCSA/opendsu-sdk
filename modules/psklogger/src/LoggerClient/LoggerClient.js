const GenericLoggerClient = require('./GenericLoggerClient');
const LogLevel = require('../utils/LogLevel');
const LoggerInterface = require('./LoggerInterface');

/**
 *
 * @param {TransportInterface} messagePublisher
 * @implements LoggerInterface
 * @constructor
 */
function LoggerClient(messagePublisher) {
    LoggerInterface.call(this);

    const genericLoggerClient = new GenericLoggerClient(messagePublisher);


    /************* PUBLIC METHODS *************/

    const public_methods = ["debug", "error", "info", "log", "warn"];

    function exposePublicMethod(target, methodName) {
        let handler = function (meta = {}, ...params) {
            const logLevel = _getLogLevel(LogLevel.debug);
            return genericLoggerClient.log(logLevel, meta, params);
        };
        Object.defineProperty(handler, "name", {value: methodName});
        target[methodName] = handler;
    }

    let self = this;
    public_methods.forEach(function (methodName) {
        exposePublicMethod(self, methodName);
    });

    function event(channel, meta = {}, ...params) {
        return genericLoggerClient.event(channel, meta, ...params);
    }

    function redirect(channel, logObject) {
        return genericLoggerClient.publish(channel, logObject)
    }


    /************* PRIVATE METHODS *************/

    function _getLogLevel(levelCode) {
        return {
            code: levelCode,
            name: LogLevel[levelCode]
        };
    }


    /************* EXPORTS *************/
    this.event = event;
    this.redirect = redirect;
}

module.exports = LoggerClient;
