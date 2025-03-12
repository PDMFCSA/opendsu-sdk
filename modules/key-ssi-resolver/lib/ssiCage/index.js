const or = require("overwrite-require");
switch ($$.environmentType) {
    case or.constants.THREAD_ENVIRONMENT_TYPE:
    case or.constants.NODEJS_ENVIRONMENT_TYPE:
        module.exports = require("./NodeSSICage");
        break;
    case or.constants.BROWSER_ENVIRONMENT_TYPE:
        module.exports = require("./BrowserSSICage");
        break;
    case or.constants.WEB_WORKER_ENVIRONMENT_TYPE:
    case or.constants.SERVICE_WORKER_ENVIRONMENT_TYPE:
    case or.constants.ISOLATE_ENVIRONMENT_TYPE:
    default:
        throw new Error("No implementation of SSI Cage for this env type.");
}