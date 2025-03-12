const getLokiEnclaveFacade = (pth) => {
    if (typeof $$.LokiEnclaveFacade === "undefined") {
        const lokiEnclaveFacadeModule = require("loki-enclave-facade");
        $$.LokiEnclaveFacade = lokiEnclaveFacadeModule.createLokiEnclaveFacadeInstance(pth);
    }

    return $$.LokiEnclaveFacade;
}

module.exports = {
    getLokiEnclaveFacade
}