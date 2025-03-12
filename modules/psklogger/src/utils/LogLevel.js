const LogLevel = {};

LogLevel[LogLevel["error"] = 0] = "error";
LogLevel[LogLevel["warn"] = 1] = "warn";
LogLevel[LogLevel["info"] = 2] = "info";
LogLevel[LogLevel["debug"] = 3] = "debug";
LogLevel[LogLevel["log"] = 4] = "log";

module.exports = Object.freeze(LogLevel);
