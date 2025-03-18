const {PERSISTENCE_TYPES} = require("./constants");
const factories = {};

function PersistenceFactory() {
}

PersistenceFactory.prototype.register = (storageType, persistenceFactoryFunction) => {
    factories[storageType] = persistenceFactoryFunction;
}

PersistenceFactory.prototype.create = (storageType, ...args) => {
    return factories[storageType](...args);
}

const {createCouchDBEnclaveFacadeInstance} = require("loki-enclave-facade");
PersistenceFactory.prototype.register(PERSISTENCE_TYPES.COUCH, createCouchDBEnclaveFacadeInstance);

module.exports = new PersistenceFactory();