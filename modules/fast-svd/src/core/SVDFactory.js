/*
    A SVDIdentifiers is in format svd:type:id
 */
const FSStrategy = require("../persistenceStrategies/FSStrategy");
const SVDBase = require("./SVDBase");


function SVDFactory(persistenceStrategy, signatureProvider) {
    let typesRegistry = {};

    if (!persistenceStrategy) {
        persistenceStrategy = new FSStrategy("./svds");
    }

    this.registerType = function (typeName, description) {
        typesRegistry[typeName] = description;
    }

    this.restore = function (svdId, transaction, callback) {
        persistenceStrategy.loadState(svdId, function (err, state) {
            if (err) {
                console.log("@@Error at loading state: " + err);
                callback(err);
                return;
            }
            const svdInstance = new SVDBase(svdId, state, typesRegistry[svdId.getTypeName()], transaction, false);
            callback(undefined, svdInstance);
        });
    }

    this.store = function (changesForAllSVDS, transactionHandler, callback) {
        changesForAllSVDS.forEach(entry => {
            entry.signature = signatureProvider.sign(entry.state.__version, entry.changes);
        })
        //console.debug("Storing diff: ", changesForAllSVDS);
        persistenceStrategy.storeAndUnlock(changesForAllSVDS, transactionHandler, callback);
    }

    this.create = function (svdId, transaction, ...args) {
        return new SVDBase(svdId, args, typesRegistry[svdId.getTypeName()], transaction, true);
    }
}

module.exports = SVDFactory;