function runSyncFunction({apiSpaceName, functionName, params}) {
    const openDSU = require("opendsu");
    const api = openDSU.loadAPI(apiSpaceName);

    if (!api[functionName]) {
        throw Error(`function "${functionName}" does not exists in "${apiSpaceName}"!`)
    }

    return api[functionName].apply(undefined, params);
}

function runSyncFunctionOnlyFromWorker({apiSpaceName, functionName, params}) {
    return runSyncFunction({apiSpaceName, functionName, params})
}

module.exports = {
    runSyncFunction,
    runSyncFunctionOnlyFromWorker
}