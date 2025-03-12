function getTime() {
    const envTypes = require("overwrite-require").constants;
    switch ($$.environmentType) {
        case envTypes.NODEJS_ENVIRONMENT_TYPE:
            const perf_hooksModule = 'perf_hooks';
            const {performance} = require(perf_hooksModule);
            return performance.now() + performance.timeOrigin;
        default:
            return Date.now();
    }
}

function createLog(logLevel, meta, messages) {
    return {
        level: logLevel,
        messages: messages,
        meta: meta,
        time: getTime()
    }
}

function createEvent(meta, messages) {
    return {
        messages,
        meta,
        time: getTime()
    };
}

module.exports = {
    createLog,
    createEvent
};
