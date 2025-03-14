const getLokiEnclaveFacade = (pth) => {
    if (typeof $$.LokiEnclaveFacade === "undefined") {
        const lokiEnclaveFacadeModule = require("loki-enclave-facade");
        $$.LokiEnclaveFacade = lokiEnclaveFacadeModule.createLokiEnclaveFacadeInstance(pth);
    }

    return $$.LokiEnclaveFacade;
}

const getCouchEnclaveFacade = (pth) => {
    if (typeof $$.CouchEnclaveFacade === "undefined") {
        const couchEnclaveFacadeModule = require("loki-enclave-facade");
        $$.CouchEnclaveFacade = couchEnclaveFacadeModule.createCouchDBEnclaveFacadeInstance(pth);
    }

    return $$.LokiEnclaveFacade;
}

module.exports = {
    getLokiEnclaveFacade,
    getCouchEnclaveFacade
}