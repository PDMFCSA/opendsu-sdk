const fs = require("fs");
const path = require("path");

const getLokiEnclaveFacade = (storageFile) => {
    if (typeof $$.lokiEnclaveFacade === "undefined") {
        try {
            fs.accessSync(path.dirname(storageFile));
        } catch (e) {
            fs.mkdirSync(path.dirname(storageFile), {recursive: true});
        }
        const lokiEnclaveFacadeModule = require("loki-enclave-facade");
        const createLokiEnclaveFacadeInstance = lokiEnclaveFacadeModule.createLokiEnclaveFacadeInstance;
        $$.lokiEnclaveFacade = createLokiEnclaveFacadeInstance(storageFile);
    }

    return $$.lokiEnclaveFacade;
}

const getCouchEnclaveFacade = (storageFile) => {
    if (typeof $$.couchEnclaveFacade === "undefined") {
        try {
            fs.accessSync(path.dirname(storageFile));
        } catch (e) {
            fs.mkdirSync(path.dirname(storageFile), {recursive: true});
        }
        const couchEnclaveFacadeModule = require("loki-enclave-facade");
        const createCouchEnclaveFacadeInstance = couchEnclaveFacadeModule.createCouchDBEnclaveFacadeInstance;
        $$.couchEnclaveFacade = createCouchEnclaveFacadeInstance(storageFile);
    }

    return $$.couchEnclaveFacade;
}


module.exports = {
    getLokiEnclaveFacade,
    getCouchEnclaveFacade
}
