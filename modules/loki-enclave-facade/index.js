const LightDBServer = require("./LightDBServer");
const LokiEnclaveFacade = require("./LokiEnclaveFacade");
const CouchDBEnclaveFacade = require("./CouchDBEnclaveFacade");
const LightDBAdapter = require("./adapters/LightDBAdapter");
const CouchDBServer = require("./CouchDBServer");
const {DBService} = require("./services/DBService");
const {remapObject} = require("./utils");
const createLokiEnclaveFacadeInstance = (storage, autoSaveInterval, adaptorConstructorFunction) => {
    return new LokiEnclaveFacade(storage, autoSaveInterval, adaptorConstructorFunction);
    // return createCouchDBEnclaveFacadeInstance(storage, autoSaveInterval, adaptorConstructorFunction);
}

const createLightDBServerInstance = (config, callback) => {
    return new LightDBServer(config, callback);
    // return createCouchDBServerInstance(config, callback);
}

const createCouchDBEnclaveFacadeInstance = (storage, autoSaveInterval, adaptorConstructorFunction) => {
    return new CouchDBEnclaveFacade(storage, autoSaveInterval, adaptorConstructorFunction);
}

const createCouchDBServerInstance = (config, callback) => {
    return new CouchDBServer(config, callback);
}

module.exports = {
    DBService,
    LightDBAdapter,
    remapObject,
    createLokiEnclaveFacadeInstance,
    createLightDBServerInstance,
    createCouchDBEnclaveFacadeInstance,
    createCouchDBServerInstance,
    Adapters: require("./adapters")
}
